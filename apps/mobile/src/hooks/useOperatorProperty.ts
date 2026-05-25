import { useState, useEffect } from 'react';
import { getOperatorProperties } from '../lib/operator-api';

export interface PropertyOption {
  id: string;
  name: string;
  city: string;
}

/**
 * WF-001: Shared hook for operator screens that need a property selector.
 *
 * Loads all properties from the operator dashboard cache (no extra network
 * round-trip after first load), auto-selects the first property, and exposes
 * the selected propertyId + a setter so the screen can render a chip strip.
 *
 * Usage:
 *   const { properties, propertyId, setPropertyId, loading } = useOperatorProperty();
 */
export function useOperatorProperty() {
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getOperatorProperties()
      .then((props) => {
        if (cancelled) return;
        setProperties(props);
        // Auto-select first only if nothing is selected yet
        setPropertyId((prev) => (prev ? prev : (props[0]?.id ?? '')));
      })
      .catch(() => {
        // Silent — screens handle the empty-state themselves
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { properties, propertyId, setPropertyId, loading };
}
