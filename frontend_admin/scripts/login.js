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

// Check if already logged in
auth.onAuthStateChanged(user => {
    if (user) {
        window.location.href = 'Admin.html';
    }
});

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    let email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const btn = document.getElementById('login-btn');
    const errorDiv = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');

    // If user enters a raw username (e.g., 'admin'), convert it to a valid Firebase email
    if (!email.includes('@')) {
        email = email + '@cartpunch.com';
    }

    btn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i><span>Signing in...</span>';
    lucide.createIcons();
    errorDiv.classList.add('hidden');

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Success, the onAuthStateChanged will trigger and redirect
        })
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
