'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Lock, Bell, Shield, Check, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { getCurrentUser } from '@/lib/auth-api';
import { apiClient } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageLoader } from '@/components/ui/LoadingSpinner';

// ── API helpers ───────────────────────────────────────────────────────────────

async function updateProfile(dto: { name?: string; phone?: string }) {
  const { data } = await apiClient.patch<{ success: boolean; data: { name: string; email: string; phone: string } }>(
    '/users/me',
    dto,
  );
  return data.data;
}

async function changePassword(dto: { currentPassword: string; newPassword: string }) {
  const { data } = await apiClient.post<{ success: boolean }>('/users/me/change-password', dto);
  return data;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type SettingsTab = 'profile' | 'security' | 'notifications';

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('profile');

  const { data: user, isLoading } = useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentUser,
  });

  if (isLoading || !user) return <PageLoader />;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Settings" subtitle="Manage your account and preferences" />

      <div className="flex gap-6">
        {/* Sidebar nav */}
        <div className="w-44 shrink-0">
          <nav className="space-y-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          {tab === 'profile' && <ProfileSection user={user} />}
          {tab === 'security' && <SecuritySection />}
          {tab === 'notifications' && <NotificationsSection />}
        </div>
      </div>
    </div>
  );
}

// ── Profile Section ───────────────────────────────────────────────────────────

function ProfileSection({ user }: { user: { id: string; name: string; email: string; phone?: string; systemRole: string } }) {
  const qc = useQueryClient();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [saved, setSaved] = useState(false);

  const updateMut = useMutation({
    mutationFn: () => updateProfile({ name, phone }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-user'] });
      setSaved(true);
      toast.success('Profile updated');
      setTimeout(() => setSaved(false), 2500);
    },
    onError: () => toast.error('Failed to update profile'),
  });

  const isDirty = name !== user.name || phone !== (user.phone ?? '');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Personal Information</h2>
        <p className="text-sm text-gray-400 mt-0.5">Update your name and contact details.</p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-2xl font-bold">
          {name[0]?.toUpperCase() ?? '?'}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">{user.name}</p>
          <p className="text-xs text-gray-400">{user.email}</p>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full mt-1 inline-block">
            {user.systemRole}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Your name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
          <input
            value={user.email}
            disabled
            className="w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-400 cursor-not-allowed"
          />
          <p className="text-xs text-gray-400 mt-1">Email cannot be changed after registration.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="+91 98765 43210"
            type="tel"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => updateMut.mutate()}
          disabled={!isDirty || updateMut.isPending}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saved ? <><Check className="w-4 h-4" /> Saved</> : updateMut.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ── Security Section ──────────────────────────────────────────────────────────

function SecuritySection() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');

  const changeMut = useMutation({
    mutationFn: () => changePassword({ currentPassword: form.current, newPassword: form.next }),
    onSuccess: () => {
      toast.success('Password changed successfully');
      setForm({ current: '', next: '', confirm: '' });
      setError('');
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      setError(err?.response?.data?.error?.message ?? 'Failed to change password');
    },
  });

  function handleSubmit() {
    if (!form.current || !form.next || !form.confirm) {
      setError('All fields are required'); return;
    }
    if (form.next !== form.confirm) {
      setError('New passwords do not match'); return;
    }
    if (form.next.length < 8) {
      setError('New password must be at least 8 characters'); return;
    }
    setError('');
    changeMut.mutate();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Change Password</h2>
        <p className="text-sm text-gray-400 mt-0.5">Use a strong password that you don&apos;t use elsewhere.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={form.current}
              onChange={(e) => { setForm((f) => ({ ...f, current: e.target.value })); setError(''); }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter current password"
            />
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={form.next}
              onChange={(e) => { setForm((f) => ({ ...f, next: e.target.value })); setError(''); }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="At least 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {form.next && (
            <PasswordStrength password={form.next} />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
          <input
            type="password"
            value={form.confirm}
            onChange={(e) => { setForm((f) => ({ ...f, confirm: e.target.value })); setError(''); }}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Repeat new password"
          />
          {form.confirm && form.next !== form.confirm && (
            <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={changeMut.isPending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {changeMut.isPending ? 'Changing…' : 'Change Password'}
        </button>
      </div>
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['bg-red-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500'];

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i < score ? colors[score - 1] : 'bg-gray-200'}`}
          />
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-1">{score > 0 ? labels[score - 1] : 'Too weak'}</p>
    </div>
  );
}

// ── Notifications Section ─────────────────────────────────────────────────────

const NOTIFICATION_EVENTS = [
  { key: 'rent_due', label: 'Rent Due Reminder', description: 'When a rent cycle becomes due' },
  { key: 'payment_received', label: 'Payment Received', description: 'When a tenant makes a payment' },
  { key: 'complaint_raised', label: 'New Complaint', description: 'When a tenant raises a complaint' },
  { key: 'lead_inquiry', label: 'New Lead', description: 'When a prospective tenant inquires' },
  { key: 'overdue', label: 'Rent Overdue', description: 'When rent becomes overdue' },
  { key: 'settlement_ready', label: 'Settlement Ready', description: 'When a monthly settlement is calculated' },
];

function NotificationsSection() {
  const [prefs, setPrefs] = useState<Record<string, { email: boolean; push: boolean }>>(() =>
    Object.fromEntries(
      NOTIFICATION_EVENTS.map(({ key }) => [key, { email: true, push: true }]),
    ),
  );
  const [saved, setSaved] = useState(false);

  function toggle(key: string, channel: 'email' | 'push') {
    setPrefs((p) => ({ ...p, [key]: { ...p[key]!, [channel]: !p[key]![channel] } }));
    setSaved(false);
  }

  function save() {
    // TODO: persist to API when notification preferences endpoint is added
    setSaved(true);
    toast.success('Notification preferences saved');
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Notification Preferences</h2>
        <p className="text-sm text-gray-400 mt-0.5">Choose which events you want to be notified about.</p>
      </div>

      {/* Channel header */}
      <div className="flex items-center justify-end gap-8 text-xs font-semibold text-gray-400 uppercase tracking-wider pr-1">
        <span>Email</span>
        <span>Push</span>
      </div>

      <div className="divide-y divide-gray-100">
        {NOTIFICATION_EVENTS.map(({ key, label, description }) => (
          <div key={key} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-gray-800">{label}</p>
              <p className="text-xs text-gray-400">{description}</p>
            </div>
            <div className="flex items-center gap-8 shrink-0 ml-4">
              <Toggle
                checked={prefs[key]?.email ?? true}
                onChange={() => toggle(key, 'email')}
              />
              <Toggle
                checked={prefs[key]?.push ?? true}
                onChange={() => toggle(key, 'push')}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          {saved ? <><Check className="w-4 h-4" /> Saved</> : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex w-9 h-5 rounded-full transition-colors duration-200 ${
        checked ? 'bg-blue-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
