'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import type { AuthUser, BusinessSettings } from '@/lib/auth-types'

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [me, s] = await Promise.all([
          api<{ user: AuthUser }>('/api/auth/me'),
          api<{ settings: BusinessSettings }>('/api/business-settings/me').catch(() => null),
        ])
        if (cancelled) return
        setUser(me.user)
        if (s) setSettings(s.settings)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load settings')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const data = await api<{ settings: BusinessSettings }>('/api/business-settings/me', {
        method: 'PUT',
        body: {
          timezone: settings.timezone,
          language: settings.language,
          emailNotifications: settings.emailNotifications,
          analyticsSharing: settings.analyticsSharing,
          dataRetentionDays: settings.dataRetentionDays,
        },
      })
      setSettings(data.settings)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-2xl">
        <div className="mb-8">
          <h2 className="text-3xl font-bold">Settings</h2>
          <p className="text-muted-foreground mt-2">Manage your account and preferences</p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <>
            <div className="bg-card rounded-lg border border-border p-8 mb-6">
              <h3 className="text-lg font-semibold mb-6">Account</h3>
              <div className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input
                    className="mt-2"
                    value={
                      user
                        ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email
                        : ''
                    }
                    disabled
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input className="mt-2" value={user?.email ?? ''} disabled />
                </div>
                <div>
                  <Label>Role</Label>
                  <Input className="mt-2" value={user?.role ?? ''} disabled />
                </div>
              </div>
            </div>

            {settings && (
              <div className="bg-card rounded-lg border border-border p-8 mb-6">
                <h3 className="text-lg font-semibold mb-6">Business defaults</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input
                      id="timezone"
                      className="mt-2"
                      value={settings.timezone ?? ''}
                      onChange={(e) =>
                        setSettings({ ...settings, timezone: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="language">Language</Label>
                    <Input
                      id="language"
                      className="mt-2"
                      value={settings.language ?? ''}
                      onChange={(e) =>
                        setSettings({ ...settings, language: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="retention">Data retention (days)</Label>
                    <Input
                      id="retention"
                      type="number"
                      min={1}
                      className="mt-2"
                      value={settings.dataRetentionDays ?? ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          dataRetentionDays: Number(e.target.value) || 90,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm mb-4">
                {error}
              </div>
            )}
            {saved && (
              <div className="p-3 bg-green-500/10 text-green-600 rounded-lg text-sm mb-4">
                Saved.
              </div>
            )}

            <Button
              onClick={handleSave}
              disabled={saving || !settings}
              className="bg-primary hover:bg-primary/90"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save changes'
              )}
            </Button>
            
            {/* Danger Zone */}
            <div className="mt-16 pt-8 border-t border-border">
              <h3 className="text-xl font-semibold text-destructive mb-2">Danger Zone</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Permanently delete all your businesses, widgets, documents, and chat sessions. Your account login will remain intact.
              </p>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (window.confirm('Are you absolutely sure? This will delete all your data and cannot be undone.')) {
                    try {
                      await api('/api/auth/reset-account', { method: 'DELETE' })
                      router.push('/dashboard/onboarding')
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Failed to reset account')
                    }
                  }
                }}
              >
                Clear Account Data
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
