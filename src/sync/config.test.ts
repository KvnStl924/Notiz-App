import { describe, expect, it } from 'vitest';
import { parseFirebaseConfig, parseSpaceCode } from './manager';

describe('Firebase-Konfiguration einfügen', () => {
  it('liest den Block aus der Firebase-Konsole', () => {
    const text = `// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyABC",
  authDomain: "notiz-app.firebaseapp.com",
  projectId: "notiz-app",
  storageBucket: "notiz-app.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef",
  measurementId: "G-XYZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);`;
    expect(parseFirebaseConfig(text)).toMatchObject({ apiKey: 'AIzaSyABC', projectId: 'notiz-app', appId: '1:1234567890:web:abcdef' });
  });
  it('liest auch JSON und Blöcke mit Komma am Ende', () => {
    expect(parseFirebaseConfig('{"apiKey":"k","projectId":"p"}')).toMatchObject({ projectId: 'p' });
    expect(parseFirebaseConfig("{ apiKey: 'k', projectId: 'p', }")).toMatchObject({ apiKey: 'k' });
  });
  it('lehnt Unbrauchbares ab', () => {
    expect(parseFirebaseConfig('hallo')).toBeNull();
    expect(parseFirebaseConfig('{ apiKey: "k" }')).toBeNull();
  });
  it('Einladungslink: Code wird erkannt', () => {
    expect(parseSpaceCode('https://x.web.app/#join-0123456789abcdef0123456789abcdef')).toBe('0123456789abcdef0123456789abcdef');
    expect(parseSpaceCode('zu kurz')).toBeNull();
  });
});
