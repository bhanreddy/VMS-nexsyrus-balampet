import './src/services/notificationManager';
import { notificationManager } from './src/services/notificationManager';
import 'expo-router/entry';

// Ensure the notification manager is initialized at the top level
notificationManager.setupListeners();
