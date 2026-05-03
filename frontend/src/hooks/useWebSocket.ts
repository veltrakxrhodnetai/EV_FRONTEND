import { useCallback, useEffect, useRef, useState } from 'react';

export type WebSocketConnectionStatus = 'CONNECTING' | 'OPEN' | 'CLOSED' | 'RECONNECTING';

type UseWebSocketResult = {
  lastMessage: MessageEvent<string> | null;
  sendMessage: (message: string) => boolean;
  connectionStatus: WebSocketConnectionStatus;
};

const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_ATTEMPTS = 10;

export function useWebSocket(url: string): UseWebSocketResult {
  const [lastMessage, setLastMessage] = useState<MessageEvent<string> | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<WebSocketConnectionStatus>('CONNECTING');

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const isUnmountedRef = useRef(false);

  const cleanupSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.onopen = null;
      socketRef.current.onmessage = null;
      socketRef.current.onerror = null;
      socketRef.current.onclose = null;
      socketRef.current.close();
      socketRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!url || isUnmountedRef.current) {
      return;
    }

    setConnectionStatus(reconnectAttemptsRef.current > 0 ? 'RECONNECTING' : 'CONNECTING');

    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => {
      reconnectAttemptsRef.current = 0;
      setConnectionStatus('OPEN');
    };

    socket.onmessage = (event) => {
      setLastMessage(event as MessageEvent<string>);
    };

    socket.onerror = () => {
      setConnectionStatus('CLOSED');
    };

    socket.onclose = () => {
      if (isUnmountedRef.current) {
        setConnectionStatus('CLOSED');
        return;
      }

      setConnectionStatus('CLOSED');

      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        return;
      }

      reconnectAttemptsRef.current += 1;
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, RECONNECT_DELAY_MS);
    };
  }, [url]);

  useEffect(() => {
    isUnmountedRef.current = false;
    reconnectAttemptsRef.current = 0;
    connect();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      cleanupSocket();
      setConnectionStatus('CLOSED');
    };
  }, [connect, cleanupSocket]);

  const sendMessage = useCallback((message: string): boolean => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(message);
      return true;
    }
    return false;
  }, []);

  return {
    lastMessage,
    sendMessage,
    connectionStatus,
  };
}

export default useWebSocket;
