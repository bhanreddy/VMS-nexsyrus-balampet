import { Database } from '@nozbe/watermelondb';
import { Platform } from 'react-native';

import schema from './schema';
import { modelClasses } from './models';

let adapter: any;

if (Platform.OS === 'web') {
  // Use LokiJS adapter for web
  const LokiJSAdapter = require('@nozbe/watermelondb/adapters/lokijs').default;
  adapter = new LokiJSAdapter({
    schema,
    useWebWorker: false,
    useIncrementalIndexedDB: true,
    onSetUpError: () => {

    }
  });
} else {
  // Use SQLite adapter for native platforms
  const SQLiteAdapter = require('@nozbe/watermelondb/adapters/sqlite').default;
  adapter = new SQLiteAdapter({
    schema,
    onSetUpError: () => {

    }
  });
}

// Then, make a Watermelon database from it!
const database = new Database({
  adapter,
  modelClasses
});

export default database;