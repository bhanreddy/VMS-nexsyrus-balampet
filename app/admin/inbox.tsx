import { Redirect } from 'expo-router';

/** Inbox now lives on the Notify Parents page (Inbox / Send tabs). */
export default function AdminInboxRedirect() {
  return <Redirect href={'/admin/notifications' as any} />;
}
