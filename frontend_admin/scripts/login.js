lucide.createIcons();

const firebaseConfig = {
    apiKey: "AIzaSyDnOqNF8U-uNKDQEZiR0AyMd6JAbFNEIFE",
    authDomain: "cartpunch-5b2d8.firebaseapp.com",
    databaseURL: "https://cartpunch-5b2d8-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "cartpunch-5b2d8",
    storageBucket: "cartpunch-5b2d8.firebasestorage.app",
    messagingSenderId: "520710359414",
    appId: "1:520710359414:web:24f13d22d295deb2a0d257"
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
const approvedRequestId = loginParams.get('req');

if (approvedEmail && approvedEmail.includes('@')) {
    document.getElementById('email').value = approvedEmail;
}
if (loginParams.get('approved') === '1') {
    approvalNotice.classList.remove('hidden');
}

function showLoginError(message) {
    errorText.textContent = message;
    errorDiv.classList.remove('hidden');
}

auth.onAuthStateChanged(async user => {
    if (!user) return;

    try {
        if (user.email !== MAIN_ADMIN_EMAIL) {
            if (!user.emailVerified) {
                await auth.signOut();
                return showLoginError('Verify your email address before signing in.');
            }
            let profile = (await db.ref(`admins/${user.uid}`).once('value')).val();
            if (!profile) {
                if (!approvedRequestId || !/^[A-Za-z0-9_-]+$/.test(approvedRequestId)) {
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
        }
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

    auth.signInWithEmailAndPassword(email, password)
        .catch((error) => {
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
