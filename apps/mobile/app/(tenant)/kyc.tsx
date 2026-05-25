import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  RefreshControl,
} from 'react-native';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { getTenantProfile, getTenantKycDocuments, uploadKycDocument, type KycDocument } from '../../src/lib/tenant-api';
import { uploadBase64, getDownloadUrl, parseFileUrl } from '../../src/lib/files-api';
import { useAsync } from '../../src/lib/hooks';
import { formatDate } from '../../src/lib/format';
import { colors } from '../../src/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const DOC_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'AADHAAR',         label: 'Aadhaar Card',      icon: '🪪' },
  { value: 'PAN',             label: 'PAN Card',           icon: '💳' },
  { value: 'PASSPORT',        label: 'Passport',           icon: '📕' },
  { value: 'DRIVING_LICENSE', label: 'Driving License',    icon: '🚗' },
  { value: 'VOTER_ID',        label: 'Voter ID',           icon: '🗳️' },
];

const DOC_LABEL: Record<string, string> = Object.fromEntries(
  DOC_TYPES.map((d) => [d.value, d.label]),
);

// ─── Sub-components ───────────────────────────────────────────────────────────

function DocCard({
  doc,
  tenantId,
  onViewPhoto,
}: {
  doc: KycDocument;
  tenantId: string;
  onViewPhoto: (fileUrl: string) => void;
}) {
  const verified = !!doc.verifiedAt;
  const fileRef = parseFileUrl(doc.fileUrl);

  return (
    <View style={cardStyles.container}>
      <View style={cardStyles.row}>
        <View style={[cardStyles.iconBox, { backgroundColor: verified ? '#d1fae5' : '#f0f4ff' }]}>
          <Text style={{ fontSize: 20 }}>{DOC_TYPES.find((d) => d.value === doc.type)?.icon ?? '📄'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={cardStyles.topRow}>
            <Text style={cardStyles.type}>{DOC_LABEL[doc.type] ?? doc.type}</Text>
            <View style={[cardStyles.badge, verified ? cardStyles.badgeGreen : cardStyles.badgeYellow]}>
              <Ionicons
                name={verified ? 'checkmark-circle' : 'time-outline'}
                size={12}
                color={verified ? '#065f46' : '#92400e'}
                style={{ marginRight: 3 }}
              />
              <Text style={[cardStyles.badgeText, { color: verified ? '#065f46' : '#92400e' }]}>
                {verified ? 'Verified' : 'Pending'}
              </Text>
            </View>
          </View>
          <Text style={cardStyles.number}>#{doc.documentNumber}</Text>
          <Text style={cardStyles.date}>Added {formatDate(doc.createdAt)}</Text>
        </View>
      </View>

      {fileRef && (
        <TouchableOpacity
          style={cardStyles.viewBtn}
          onPress={() => onViewPhoto(doc.fileUrl!)}
          activeOpacity={0.8}
        >
          <Ionicons name="image-outline" size={14} color="#4f46e5" />
          <Text style={cardStyles.viewBtnText}>View Document Photo</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  row:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 },
  type:  { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 },
  number: { fontSize: 12, color: '#6b7280', marginTop: 3, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },
  date:  { fontSize: 11, color: '#d1d5db', marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeGreen:  { backgroundColor: '#d1fae5' },
  badgeYellow: { backgroundColor: '#fef3c7' },
  badgeText:   { fontSize: 10, fontWeight: '700' },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  viewBtnText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
});

// ─── Add document form ────────────────────────────────────────────────────────

interface AddDocFormProps {
  tenantId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function AddDocForm({ tenantId, onSuccess, onCancel }: AddDocFormProps) {
  const [docType,   setDocType]   = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [imageUri,  setImageUri]  = useState<string | null>(null);
  const [imageB64,  setImageB64]  = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);

  const pickImage = useCallback(async (source: 'camera' | 'gallery') => {
    const permResult = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permResult.status !== 'granted') {
      Alert.alert(
        'Permission needed',
        source === 'camera'
          ? 'Camera access is required to take a photo.'
          : 'Photo library access is required to pick a photo.',
      );
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          base64: true,
          allowsEditing: true,
          aspect: [4, 3],
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          base64: true,
          allowsEditing: true,
          aspect: [4, 3],
        });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageB64(result.assets[0].base64 ?? null);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!docType) {
      Alert.alert('Validation', 'Please select a document type.');
      return;
    }
    if (!docNumber.trim() || docNumber.trim().length < 3) {
      Alert.alert('Validation', 'Please enter a valid document number (at least 3 characters).');
      return;
    }

    setLoading(true);
    try {
      let fileUrl: string | undefined;

      // If a photo was picked, upload it via base64 endpoint
      if (imageB64 && tenantId) {
        const file = await uploadBase64({
          entityType: 'TENANT_KYC',
          entityId:   tenantId,
          fileName:   `kyc-${docType.toLowerCase()}.jpg`,
          mimeType:   'image/jpeg',
          base64Data: imageB64,
        });
        // Store a reference ID so we can get a download URL later
        fileUrl = `file://${file.id}`;
      }

      await uploadKycDocument({
        type:           docType,
        documentNumber: docNumber.trim().toUpperCase(),
        fileUrl,
      });

      onSuccess();
    } catch (err: unknown) {
      Alert.alert('Upload Failed', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, [docType, docNumber, imageB64, tenantId, onSuccess]);

  return (
    <View style={formStyles.container}>
      <View style={formStyles.header}>
        <Text style={formStyles.title}>Add New Document</Text>
        <TouchableOpacity onPress={onCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={22} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {/* Document type grid */}
      <Text style={formStyles.label}>Document Type *</Text>
      <View style={formStyles.typeGrid}>
        {DOC_TYPES.map((dt) => (
          <TouchableOpacity
            key={dt.value}
            style={[formStyles.typeChip, docType === dt.value && formStyles.typeChipSelected]}
            onPress={() => setDocType(dt.value)}
            activeOpacity={0.8}
          >
            <Text style={formStyles.typeChipIcon}>{dt.icon}</Text>
            <Text style={[formStyles.typeChipText, docType === dt.value && formStyles.typeChipTextSelected]}>
              {dt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Document number */}
      <Text style={formStyles.label}>Document Number *</Text>
      <TextInput
        style={formStyles.input}
        value={docNumber}
        onChangeText={setDocNumber}
        placeholder="e.g. ABCDE1234F"
        autoCapitalize="characters"
        autoCorrect={false}
        placeholderTextColor="#9ca3af"
        returnKeyType="done"
      />

      {/* Photo section */}
      <Text style={formStyles.label}>Document Photo (optional)</Text>
      {imageUri ? (
        <View style={formStyles.previewContainer}>
          <Image source={{ uri: imageUri }} style={formStyles.preview} resizeMode="cover" />
          <TouchableOpacity
            style={formStyles.removePhoto}
            onPress={() => { setImageUri(null); setImageB64(null); }}
          >
            <Ionicons name="close-circle" size={22} color="#dc2626" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={formStyles.photoBtns}>
          <TouchableOpacity
            style={formStyles.photoBtn}
            onPress={() => pickImage('camera')}
            activeOpacity={0.8}
          >
            <Ionicons name="camera-outline" size={18} color={colors.primary} />
            <Text style={formStyles.photoBtnText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={formStyles.photoBtn}
            onPress={() => pickImage('gallery')}
            activeOpacity={0.8}
          >
            <Ionicons name="images-outline" size={18} color={colors.primary} />
            <Text style={formStyles.photoBtnText}>Choose from Gallery</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Submit */}
      <TouchableOpacity
        style={[formStyles.submitBtn, loading && formStyles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color="#fff" size="small" />
          : <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
        }
        <Text style={formStyles.submitText}>
          {loading ? 'Uploading…' : 'Save Document'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const formStyles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title:  { fontSize: 16, fontWeight: '700', color: '#111827' },
  label:  { fontSize: 12, fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
  },
  typeChipSelected:     { borderColor: colors.primary, backgroundColor: '#eef2ff' },
  typeChipIcon:         { fontSize: 16 },
  typeChipText:         { fontSize: 13, color: '#374151', fontWeight: '500' },
  typeChipTextSelected: { color: colors.primary, fontWeight: '700' },

  input: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#f9fafb',
    marginBottom: 16,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },

  previewContainer: {
    position: 'relative',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  preview: { width: '100%', height: 180, borderRadius: 12 },
  removePhoto: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },

  photoBtns: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 11,
    backgroundColor: '#eef2ff',
  },
  photoBtnText: { fontSize: 13, color: colors.primary, fontWeight: '600' },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  submitBtnDisabled: { backgroundColor: '#a5b4fc' },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function KycScreen() {
  const [showForm, setShowForm] = useState(false);

  const { data: profile } = useAsync(getTenantProfile, []);
  const {
    data: docs,
    loading,
    error,
    refetch,
  } = useAsync(getTenantKycDocuments, []);

  const tenantId = profile?.id ?? '';

  const handleViewPhoto = useCallback(async (fileUrl: string) => {
    const ref = parseFileUrl(fileUrl);
    if (!ref) return;

    try {
      if (ref.type === 'fileId') {
        const { downloadUrl } = await getDownloadUrl(ref.id);
        await WebBrowser.openBrowserAsync(downloadUrl, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        });
      } else {
        await WebBrowser.openBrowserAsync(ref.url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        });
      }
    } catch {
      Alert.alert('Error', 'Could not open the document. Please try again.');
    }
  }, []);

  const handleFormSuccess = useCallback(() => {
    setShowForm(false);
    refetch();
  }, [refetch]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={loading && !!docs} onRefresh={refetch} />}
    >
      {/* Page header */}
      <View style={styles.pageHeader}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} style={{ marginRight: 6 }} />
        <Text style={styles.pageHeaderText}>Identity Verification</Text>
      </View>
      <Text style={styles.pageSubtitle}>
        Upload your government-issued ID for KYC verification. Documents are stored securely.
      </Text>

      {/* Error state */}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refetch} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading state */}
      {loading && !docs && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {/* Document list */}
      {docs && docs.length === 0 && !showForm && (
        <View style={styles.emptyBox}>
          <Ionicons name="document-outline" size={44} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No documents yet</Text>
          <Text style={styles.emptyText}>Add your Aadhaar or PAN card to complete verification.</Text>
        </View>
      )}

      {docs?.map((doc) => (
        <DocCard key={doc.id} doc={doc} tenantId={tenantId} onViewPhoto={handleViewPhoto} />
      ))}

      {/* Add form */}
      {showForm ? (
        <AddDocForm
          tenantId={tenantId}
          onSuccess={handleFormSuccess}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowForm(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.addBtnText}>Add Document</Text>
        </TouchableOpacity>
      )}

      {/* Info note */}
      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={16} color="#6b7280" style={{ marginRight: 6 }} />
        <Text style={styles.infoText}>
          Document photos are stored in encrypted cloud storage. Your data is never shared without consent.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray100 },
  list:      { padding: 16, gap: 12, paddingBottom: 40 },

  pageHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  pageHeaderText: { fontSize: 17, fontWeight: '700', color: '#111827' },
  pageSubtitle:   { fontSize: 13, color: '#6b7280', lineHeight: 19, marginBottom: 4 },

  errorBox:  { backgroundColor: '#fef2f2', borderRadius: 12, padding: 16, alignItems: 'center', gap: 8 },
  errorText: { color: '#dc2626', fontSize: 14, textAlign: 'center' },
  retryBtn:  { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#dc2626', borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  center:     { paddingVertical: 32, alignItems: 'center' },
  emptyBox:   { paddingVertical: 40, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptyText:  { fontSize: 13, color: '#9ca3af', textAlign: 'center' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  addBtnText: { fontSize: 15, color: colors.primary, fontWeight: '700' },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
  },
  infoText: { flex: 1, fontSize: 11, color: '#6b7280', lineHeight: 16 },
});
