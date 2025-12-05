import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert } from "react-native";
import { createUserWithEmailAndPassword } from "../utils/firebase";
import { auth } from "../utils/firebase";

export default function RegisterScreen({ navigation }: any) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const register = async () => {
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            Alert.alert("Berhasil", "Akun berhasil dibuat!");
            navigation.goBack();
        } catch (e: any) {
            Alert.alert("Error", e.message);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Daftar Akun</Text>

            <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
            />

            <TextInput
                style={styles.input}
                placeholder="Password (min 6 karakter)"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
            />

            <Button title="Register" onPress={register} />

            <Text
                style={styles.link}
                onPress={() => navigation.navigate("LoginEmail")}
            >
                Sudah punya akun? Login
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: "center", padding: 20 },
    title: { fontSize: 26, marginBottom: 20, textAlign: "center" },
    input: {
        borderWidth: 1,
        marginBottom: 12,
        padding: 10,
        borderRadius: 8,
    },
    link: { marginTop: 15, color: "blue", textAlign: "center" },
});
