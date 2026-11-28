// One-time email verification code for newly approved admins.
// The code is emailed with the EmailJS "One-Time Password" template and only its
// SHA-256 hash is stored in admin_otp/<uid>, so it cannot be read back from the database.

const OTP_EMAILJS_PUBLIC_KEY = 'IMe8nVqxdPtnxetW0';
const OTP_EMAILJS_SERVICE_ID = 'service_wvjz4b8';
const OTP_EMAILJS_TEMPLATE_ID = 'template_5avmab9';
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

let otpEmailInitialized = false;

async function otpHash(uid, code) {
    const bytes = new TextEncoder().encode(`${uid}:${code}`);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateOtpCode() {
    const value = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
    return String(value).padStart(6, '0');
}

// True when this account no longer needs a code: Firebase already verified the
// address (older admins) or the code was entered before.
async function isEmailCodeVerified(db, user) {
    if (user.emailVerified) return true;
    const snapshot = await db.ref(`admin_otp/${user.uid}/verifiedAt`).once('value');
    return Number.isFinite(snapshot.val());
}

async function sendEmailCode(db, user) {
    if (!otpEmailInitialized) {
        emailjs.init(OTP_EMAILJS_PUBLIC_KEY);
        otpEmailInitialized = true;
    }
    const code = generateOtpCode();
    const now = Date.now();
    await db.ref(`admin_otp/${user.uid}`).set({
        codeHash: await otpHash(user.uid, code),
        sentAt: now,
        expiresAt: now + OTP_TTL_MS,
        attempts: 0
    });
    await emailjs.send(OTP_EMAILJS_SERVICE_ID, OTP_EMAILJS_TEMPLATE_ID, {
        to_email: user.email,
        email: user.email,
        otp_code: code,
        expires_in: '5 minutes'
    });
    return now + OTP_TTL_MS;
}

// Returns { ok: true } or { ok: false, message }.
async function checkEmailCode(db, user, code) {
    const ref = db.ref(`admin_otp/${user.uid}`);
    const record = (await ref.once('value')).val();
    if (!record || !record.codeHash) {
        return { ok: false, message: 'No code is active. Click "Resend code" to get a new one.' };
    }
    if (Date.now() >= record.expiresAt) {
        return { ok: false, message: 'This code expired. Click "Resend code" to get a new one.' };
    }
    if ((record.attempts || 0) >= OTP_MAX_ATTEMPTS) {
        return { ok: false, message: 'Too many wrong attempts. Click "Resend code" to get a new one.' };
    }
    if (await otpHash(user.uid, code) !== record.codeHash) {
        const attempts = (record.attempts || 0) + 1;
        await ref.child('attempts').set(attempts);
        const left = OTP_MAX_ATTEMPTS - attempts;
        return { ok: false, message: left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many wrong attempts. Click "Resend code" to get a new one.' };
    }
    await ref.set({ verifiedAt: Date.now() });
    return { ok: true };
}
