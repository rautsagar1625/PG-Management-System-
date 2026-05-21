'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Building2,
  MapPin,
  Phone,
  BedDouble,
  Star,
  Loader2,
  AlertCircle,
  X,
  CheckCircle2,
  Send,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────

interface PublicProperty {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  address: string;
  type: 'MALE' | 'FEMALE' | 'MIXED';
  description?: string;
  amenities: string[];
  contactPhone?: string;
  availableRooms: number;
  totalRooms: number;
}

// ── API (no auth header — apiClient handles token absence gracefully) ──

async function getPublicProperty(slug: string): Promise<PublicProperty> {
  const { data } = await apiClient.get<{ success: boolean; data: PublicProperty }>(
    `/properties/public/${slug}`,
    // Ensure we don't accidentally send auth header for this public endpoint
    { headers: { Authorization: '' } },
  );
  return data.data;
}

async function submitEnquiry(dto: {
  propertyId: string;
  name: string;
  phone: string;
}): Promise<void> {
  await apiClient.post('/leads', {
    ...dto,
    source: 'WEBSITE',
  });
}

// ── Type badge ────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  MALE: { label: 'Boys PG', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  FEMALE: { label: 'Girls PG', cls: 'bg-pink-100 text-pink-700 border-pink-200' },
  MIXED: { label: 'Co-ed PG', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
};

// ── Main page (no dashboard layout — lives outside (dashboard) group) ──

export default function PublicPropertyPage() {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : '';

  const [showEnquiry, setShowEnquiry] = useState(false);
  const [enquiryForm, setEnquiryForm] = useState({ name: '', phone: '' });
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');

  const { data: property, isLoading, isError } = useQuery({
    queryKey: ['public-property', slug],
    queryFn: () => getPublicProperty(slug),
    enabled: !!slug,
    retry: false,
  });

  const enquiryMutation = useMutation({
    mutationFn: () =>
      submitEnquiry({
        propertyId: property!.id,
        name: enquiryForm.name,
        phone: enquiryForm.phone,
      }),
    onSuccess: () => {
      setSubmitted(true);
      setFormError('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? 'Failed to submit enquiry. Please try again.');
    },
  });

  // ── Loading ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm text-gray-400">Loading property…</p>
        </div>
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────

  if (isError || !property) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Property Not Found</h1>
          <p className="text-sm text-gray-500">
            The property listing you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  // ── Property page ────────────────────────────────────────────────────

  const typeCfg = TYPE_CONFIG[property.type];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Minimal public header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg">PG Manager</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Hero card */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
          {/* Top banner */}
          <div
            className="h-32 flex items-end px-6 pb-5"
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            }}
          >
            <div className="flex items-end gap-4 w-full">
              <div className="w-16 h-16 bg-white rounded-xl shadow-lg flex items-center justify-center border-2 border-white">
                <Building2 className="w-8 h-8 text-indigo-600" />
              </div>
              <div className="pb-1">
                <h1 className="text-2xl font-bold text-white leading-tight">{property.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-white/70" />
                  <span className="text-sm text-white/80">
                    {property.city}, {property.state}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5">
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border',
                  typeCfg.cls,
                )}
              >
                <Star className="w-3 h-3" />
                {typeCfg.label}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border',
                  property.availableRooms > 0
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-red-50 text-red-600 border-red-200',
                )}
              >
                <BedDouble className="w-3 h-3" />
                {property.availableRooms > 0
                  ? `${property.availableRooms} rooms available`
                  : 'Fully occupied'}
              </span>
            </div>

            {/* Description */}
            {property.description && (
              <p className="text-sm text-gray-600 leading-relaxed">{property.description}</p>
            )}

            {/* Address */}
            <div className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <span>{property.address}</span>
            </div>

            {/* Amenities */}
            {property.amenities.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Amenities
                </p>
                <div className="flex flex-wrap gap-2">
                  {property.amenities.map((a) => (
                    <span
                      key={a}
                      className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-full font-medium"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Contact + CTA */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              {property.contactPhone && (
                <a
                  href={`tel:${property.contactPhone}`}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <Phone className="w-4 h-4 text-gray-500" />
                  {property.contactPhone}
                </a>
              )}
              <button
                onClick={() => setShowEnquiry(true)}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-md shadow-indigo-200 transition-colors"
              >
                <Send className="w-4 h-4" />
                Enquire Now
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 pb-4">
          Powered by PG Manager &mdash; The complete PG Management Platform
        </p>
      </main>

      {/* Enquiry modal */}
      {showEnquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => { if (!submitted) { setShowEnquiry(false); setFormError(''); } }}
            aria-hidden
          />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div
              className="px-6 py-5"
              style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white">Enquire about {property.name}</h2>
                {!submitted && (
                  <button
                    onClick={() => { setShowEnquiry(false); setFormError(''); }}
                    className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              <p className="text-sm text-white/70 mt-1">
                Leave your details and we&apos;ll get in touch.
              </p>
            </div>

            <div className="p-6">
              {submitted ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg">Enquiry Sent!</h3>
                  <p className="text-sm text-gray-500 mt-1 mb-5">
                    The PG team will contact you shortly.
                  </p>
                  <button
                    onClick={() => {
                      setShowEnquiry(false);
                      setSubmitted(false);
                      setEnquiryForm({ name: '', phone: '' });
                    }}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Your Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={enquiryForm.name}
                      onChange={(e) =>
                        setEnquiryForm((f) => ({ ...f, name: e.target.value }))
                      }
                      className="input-field w-full"
                      placeholder="Full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={enquiryForm.phone}
                      onChange={(e) =>
                        setEnquiryForm((f) => ({ ...f, phone: e.target.value }))
                      }
                      className="input-field w-full"
                      placeholder="10-digit mobile number"
                    />
                  </div>

                  {formError && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {formError}
                    </div>
                  )}

                  <button
                    onClick={() => enquiryMutation.mutate()}
                    disabled={
                      enquiryMutation.isPending ||
                      !enquiryForm.name.trim() ||
                      !enquiryForm.phone.trim()
                    }
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-md shadow-indigo-200 transition-colors disabled:opacity-50"
                  >
                    {enquiryMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Send Enquiry
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
