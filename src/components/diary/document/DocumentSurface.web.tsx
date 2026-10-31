import React, { useEffect, useRef } from 'react';
import type { DocumentSurfaceProps } from './DocumentSurface';

export default function DocumentSurface({ html, onMessage }: DocumentSurfaceProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source === frame.current?.contentWindow && typeof event.data === 'string') onMessage(event.data);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [onMessage]);
  return <iframe ref={frame} title="Diary photo scanner" srcDoc={html} sandbox="allow-scripts"
    style={{ border: 0, width: '100%', height: '100%', flex: 1, background: '#0F172A' }} />;
}
