import { auth } from './firebase-config.js';

// Check if user is already authenticated
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        // User is signed in, redirect to index
        window.location.replace('/index.html');
    }
});

// Login Form Handler
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    
    try {
        errorMessage.textContent = '';
        await auth.signInWithEmailAndPassword(email, password);
        window.location.href = '/index.html';
    } catch (error) {
        // Handle specific error cases
        switch (error.code) {
            case 'auth/invalid-email':
                errorMessage.textContent = 'Invalid email address';
                break;
            case 'auth/user-disabled':
                errorMessage.textContent = 'This account has been disabled';
                break;
            case 'auth/user-not-found':
                errorMessage.textContent = 'No account found with this email';
                break;
            case 'auth/wrong-password':
                errorMessage.textContent = 'Incorrect password';
                break;
            default:
                errorMessage.textContent = 'An error occurred. Please try again.';
                console.error('Login error:', error);
        }
    }
}); 


