import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'userToken';

export async function saveUser(token: string): Promise<void> {
    try {
        await AsyncStorage.setItem(KEY, token);
    } catch (error) {
        console.log('Error saving token', error);
    }
}

export async function getUser(): Promise<string | null> {
    try {
        return await AsyncStorage.getItem(KEY);
    } catch (error) {
        console.log('Error getting token', error);
        return null;
    }
}

export async function logoutUser(): Promise<void> {
    try {
        await AsyncStorage.removeItem(KEY);
    } catch (error) {
        console.log('Error removing token', error);
    }
}

// Optional helper: check if logged in
export async function isLoggedIn(): Promise<boolean> {
    return (await getUser()) != null;
}