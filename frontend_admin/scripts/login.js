lucide.createIcons();

const firebaseConfig = {
    apiKey: "AIzaSyAnpeLs7fpfkWIxdlqttvd9N_kQM1fss0E",
    authDomain: "cartpunch-a2267.firebaseapp.com",
    databaseURL: "https://cartpunch-a2267-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "cartpunch-a2267",
    storageBucket: "cartpunch-a2267.firebasestorage.app",
    messagingSenderId: "413542821283",
    appId: "1:413542821283:web:3bb97cdb6f8b54e774fe16"
};
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.database();
const MAIN_ADMIN_EMAIL = 'cartpunch.security@gmail.com';
const errorDiv = document.getElementById('error-message');
const errorText = document.getElementById('error-text');
const approvalNotice = document.getElementById('approval-notice');
const loginParams = new URLSearchParams(window.location.search);
const approvedEmail = loginParams.get('email');
const requestIdFromLink = loginParams.get('req');
let signInRequested = false;

if (approvedEmail && approvedEmail.includes('@')) {
    document.getElementById('email').value = approvedEmail;
}
if (loginParams.get('session') === 'expired') {
    errorText.textContent = 'Your session ended after 48 hours. Please sign in again.';
    errorDiv.classList.remove('hidden');
}
if (loginParams.get('approved') === '1') {
    approvalNotice.classList.remove('hidden');
}

function showLoginError(message) {
    errorText.textContent = message;
    errorDiv.classList.remove('hidden');
}

function resetLoginButton() {
    const btn = document.getElementById('login-btn');
    btn.innerHTML = '<span>Sign In</span><i data-lucide="arrow-right" class="w-4 h-4"></i>';
    lucide.createIcons();
}

// Approved admins verify their own email with a 6-digit code the first time they
// sign in (VerifyCode.html sends it). Older admins verified by Firebase skip this.
async function requireVerifiedEmail(user) {
    if (await isEmailCodeVerified(db, user)) return true;
    if (signInRequested) {
        window.location.href = 'VerifyCode.html';
        return false;
    }
    await auth.signOut();
    resetLoginButton();
    showLoginError('Your admin request is approved. Enter your email and password to sign in and verify your email.');
    return false;
}

async function findRequestId(user) {
    const candidates = [requestIdFromLink, localStorage.getItem(`cartpunch_admin_request_${user.uid}`)];
    try {
        candidates.push((await db.ref(`admin_request_by_uid/${user.uid}`).once('value')).val());
    } catch (error) {
        console.error('Could not look up the sign-up request:', error);
    }
    return candidates.find(id => typeof id === 'string' && /^[A-Za-z0-9_-]+$/.test(id)) || null;
}

auth.onAuthStateChanged(async user => {
    if (!user) return;

    try {
        let adminProfile = {};
        if (user.email !== MAIN_ADMIN_EMAIL) {
            let profile = (await db.ref(`admins/${user.uid}`).once('value')).val();
            if (!profile) {
                // The request id comes from the approval redirect link, or from this browser if the
                // applicant signed up here and later opened the Login page directly.
                const approvedRequestId = await findRequestId(user);
                if (!approvedRequestId) {
                    await auth.signOut();
                    return showLoginError('This account has not been approved as an admin.');
                }

                const requestSnapshot = await db.ref(`pending_admin_requests/${approvedRequestId}`).once('value');
                const request = requestSnapshot.val();
                if (!request || request.status !== 'approved' ||
                    request.email.toLowerCase() !== user.email.toLowerCase() ||
                    (request.uid && request.uid !== user.uid)) {
                    await auth.signOut();
                    return showLoginError('This account has not been approved as an admin.');
                }

                profile = {
                    requestId: approvedRequestId,
                    name: request.name,
                    position: request.position,
                    department: request.department,
                    email: user.email,
                    role: 'admin',
                    approvedBy: request.resolvedBy || 'Main Admin',
                    approvedAt: request.approvedAt
                };
                await db.ref(`admins/${user.uid}`).set(profile);
            }
            if (profile.role !== 'admin') {
                await auth.signOut();
                return showLoginError('This account has not been approved as an admin.');
            }
            if (!(await requireVerifiedEmail(user))) return;
            adminProfile = profile;
        } else {
            const profileSnapshot = await db.ref(`admins/${user.uid}`).once('value');
            adminProfile = profileSnapshot.val() || {};
        }
        // The dashboard records the login event in Monitoring (once per sign-in).
        signInRequested = false;
        window.location.href = 'Admin.html';
    } catch (error) {
        console.error(error);
        await auth.signOut();
        showLoginError('Could not verify admin access: ' + error.message);
    }
});

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    let email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const btn = document.getElementById('login-btn');

    // If user enters a raw username (e.g., 'admin'), convert it to a valid Firebase email
    if (!email.includes('@')) {
        email = email + '@cartpunch.com';
    }

    btn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i><span>Signing in...</span>';
    lucide.createIcons();
    errorDiv.classList.add('hidden');
    signInRequested = true;

    auth.signInWithEmailAndPassword(email, password)
        .catch((error) => {
            signInRequested = false;
            errorDiv.classList.remove('hidden');
            errorText.textContent = error.message;
            btn.innerHTML = '<span>Sign In</span><i data-lucide="arrow-right" class="w-4 h-4"></i>';
            lucide.createIcons();
        });
});

function togglePassword() {
    const pwdInput = document.getElementById('password');
    const eyeIcon = document.getElementById('eye-icon');
    if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        eyeIcon.setAttribute('data-lucide', 'eye-off');
    } else {
        pwdInput.type = 'password';
        eyeIcon.setAttribute('data-lucide', 'eye');
    }
    lucide.createIcons();
}
