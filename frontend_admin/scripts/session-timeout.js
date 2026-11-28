// Signs out every admin except the Main Admin 48 hours after they signed in.
// A notice with a countdown appears 5 minutes before. The session start is Firebase's
// lastSignInTime, which only changes on a real sign-in (not on page reloads or new tabs).

const SESSION_LIMIT_MS = 48 * 60 * 60 * 1000;
const SESSION_WARNING_MS = 5 * 60 * 1000;
const SESSION_MAIN_ADMIN_EMAIL = 'cartpunch.security@gmail.com';

function startSessionTimeout({ auth, db, user, profile }) {
    if (!user || user.email === SESSION_MAIN_ADMIN_EMAIL) return;
    const signedInAt = Date.parse(user.metadata && user.metadata.lastSignInTime);
    if (!Number.isFinite(signedInAt)) return;
    const expiresAt = signedInAt + SESSION_LIMIT_MS;
    let notice = null;
    let signingOut = false;

    function format(ms) {
        const total = Math.max(0, Math.ceil(ms / 1000));
        return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    }

    function showNotice(remaining) {
        if (!notice) {
            notice = document.createElement('div');
            notice.setAttribute('role', 'alert');
            notice.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;max-width:360px;' +
                'background:#fffbeb;border:1px solid #fcd34d;color:#78350f;border-radius:12px;' +
                'padding:16px 18px;box-shadow:0 10px 30px rgba(15,23,42,.15);font-family:Inter,sans-serif;';
            notice.innerHTML =
                '<p style="font-weight:800;font-size:14px;margin:0 0 4px">Your session is ending</p>' +
                '<p style="font-size:13px;margin:0;line-height:1.45">For security, admin sessions last 48 hours. ' +
                'You will be signed out in <strong data-countdown style="font-variant-numeric:tabular-nums"></strong>. ' +
                'Save your work, then sign in again.</p>';
            document.body.appendChild(notice);
        }
        notice.querySelector('[data-countdown]').textContent = format(remaining);
    }

    async function expire() {
        if (signingOut) return;
        signingOut = true;
        clearInterval(timer);
        try {
            const event = {
                type: 'logout',
                uid: user.uid,
                email: user.email || '',
                displayName: (profile && profile.name) || user.email || 'Unknown admin',
                timestamp: Date.now(),
                details: 'Signed out automatically (48-hour session limit).'
            };
            if (profile && profile.position) event.position = profile.position;
            if (profile && profile.department) event.department = profile.department;
            await db.ref('monitoring').push().set(event);
        } catch (error) {
            console.error('Could not record automatic sign-out:', error);
        }
        await auth.signOut();
        window.location.replace('Login.html?session=expired');
    }

    function check() {
        const remaining = expiresAt - Date.now();
        if (remaining <= 0) {
            expire();
        } else if (remaining <= SESSION_WARNING_MS) {
            showNotice(remaining);
        }
    }

    // Checking every second keeps the countdown smooth and also catches a computer
    // that slept past the limit.
    const timer = setInterval(check, 1000);
    check();
}
