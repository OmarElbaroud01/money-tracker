import { auth, db } from './firebase-config.js';

const DEFAULT_AVATAR = "https://ui-avatars.com/api/?name=User&background=random";

const userProfiles = {
    'oelbaroudi@acamorocco.org': {
        name: 'Omar',
        wallet: "Omar's wallet",
        currency: 'MAD',
        avatar: `https://ui-avatars.com/api/?name=Omar&background=random`
    },
    'schipani.jacqueline@gmail.com': {
        name: 'Jackie',
        wallet: "Jackie's wallet",
        currency: 'MAD',
        avatar: `https://ui-avatars.com/api/?name=Jackie&background=random`
    }
};

export const initializeUserProfile = async (user) => {
    try {
        const userProfile = userProfiles[user.email] || {
            name: user.email.split('@')[0],
            wallet: 'Default wallet',
            currency: 'MAD'
        };

        await db.ref(`users/${user.uid}/profile`).set({
            email: user.email,
            name: userProfile.name,
            wallet: userProfile.wallet,
            lastLogin: new Date().toISOString(),
            preferences: {
                currency: userProfile.currency,
                theme: 'light',
                notifications: true
            }
        });
        
        return userProfile;
    } catch (error) {
        console.error('Profile initialization failed:', error);
        throw error;
    }
};

export const getUserProfile = async (userId) => {
    try {
        const snapshot = await db.ref(`users/${userId}/profile`).once('value');
        const profile = snapshot.val();
        if (!profile) {
            // Get user data to initialize profile
            const user = auth.currentUser;
            if (user) {
                return initializeUserProfile(user);
            }
        }
        return profile;
    } catch (error) {
        console.error('Failed to get user profile:', error);
        throw error;
    }
};

export const handleSignOut = async () => {
    try {
        await auth.signOut();
        window.location.replace('/login.html');
    } catch (error) {
        console.error('Sign out failed:', error);
        throw error;
    }
}; 


