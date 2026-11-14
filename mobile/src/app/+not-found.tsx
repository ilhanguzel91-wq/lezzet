import { Redirect } from 'expo-router';

/** Unknown addresses (e.g. when the web build is hosted under another path) go to the start screen. */
export default function NotFound() {
  return <Redirect href="/" />;
}
