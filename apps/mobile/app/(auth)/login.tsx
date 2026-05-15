import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { login } from '../../src/lib/auth';
import { useAuth } from '../../src/context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { setUser } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      setUser(result.user);
      router.replace('/(tenant)/');
    } catch (err) {
      Alert.alert('Login Failed', err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        {/* Logo area */}
        <View style={styles.logoSection}>
          <View style={styles.logoBox}>
            <Text style={styles.logoIcon}>🏠</Text>
          </View>
          <Text style={styles.appName}>PG Manager</Text>
          <Text style={styles.tagline}>Tenant Portal</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor="#9ca3af"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#9ca3af"
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading || !email.trim() || !password.trim()}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>Contact your PG manager if you need help signing in.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 48 },
  logoSection: { alignItems: 'center', marginBottom: 48 },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoIcon: { fontSize: 32 },
  appName: { fontSize: 24, fontWeight: '700', color: '#111827' },
  tagline: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  form: {},
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
  },
  loginBtn: {
    marginTop: 24,
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  loginBtnDisabled: { opacity: 0.5 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  footer: { textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 40, lineHeight: 18 },
});
