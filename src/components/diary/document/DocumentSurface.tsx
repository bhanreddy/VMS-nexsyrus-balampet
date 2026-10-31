import React from 'react';
import { WebView } from 'react-native-webview';

export type DocumentSurfaceProps = { html: string; onMessage: (message: string) => void };

export default function DocumentSurface({ html, onMessage }: DocumentSurfaceProps) {
  return <WebView
    source={{ html }}
    style={{ flex: 1, backgroundColor: '#0F172A' }}
    originWhitelist={['*']}
    javaScriptEnabled
    scrollEnabled={false}
    onShouldStartLoadWithRequest={(request) => request.url === 'about:blank'}
    onMessage={(event) => onMessage(event.nativeEvent.data)}
    onError={() => onMessage(JSON.stringify({ type: 'error', message: 'The photo editor could not load. Please try again.' }))}
  />;
}
