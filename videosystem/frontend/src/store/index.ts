import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage/session';
import { combineReducers } from '@reduxjs/toolkit';
import authSlice from './slices/authSlice';
import projectsSlice from './slices/projectsSlice';
import editorSlice from './slices/editorSlice';
import uiSlice from './slices/uiSlice';

const rootReducer = combineReducers({
  auth: persistReducer(authSlice),
  projects: persistReducer(projectsSlice),
  editor: persistReducer(editorSlice),
  ui: persistReducer(uiSlice),
});

const persistConfig = {
  key: 'viracut-root',
  storage,
  whitelist: [
    'auth.user',
    'auth.session',
    'projects.currentProject',
    'editor.nodes',
    'editor.connections',
    'editor.selectedNodes',
    'editor.zoom',
    'ui.theme',
    'ui.sidebarOpen',
  ],
  blacklist: [
    'auth.loading',
    'projects.loading',
    'editor.loading',
    'editor.history',
    'ui.notifications',
  ],
  transforms: {
    auth: persistReducer((state: any, action: any) => {
      // Only persist user and session data, not loading states
      if (action.type.startsWith('auth/') && action.type.endsWith('/pending')) {
        return state;
      }
      if (action.type.startsWith('auth/') && action.type.endsWith('/rejected')) {
        return state;
      }
      return authSlice(state, action);
    }),
    projects: persistReducer((state: any, action: any) => {
      // Only persist projects data, not loading states
      if (action.type.startsWith('projects/') && action.type.endsWith('/pending')) {
        return state;
      }
      if (action.type.startsWith('projects/') && action.type.endsWith('/rejected')) {
        return state;
      }
      return projectsSlice(state, action);
    }),
    editor: persistReducer((state: any, action: any) => {
      // Only persist editor state, not loading or history states
      if (action.type.startsWith('editor/') && action.type.endsWith('/pending')) {
        return state;
      }
      if (action.type.startsWith('editor/') && action.type.endsWith('/rejected')) {
        return state;
      }
      if (action.type === 'editor/addToHistory') {
        return state;
      }
      return editorSlice(state, action);
    }),
    ui: persistReducer((state: any, action: any) => {
      // Only persist UI state, not notifications
      if (action.type.startsWith('ui/') && action.type.endsWith('/addNotification')) {
        return state;
      }
      if (action.type.startsWith('ui/') && action.type.endsWith('/removeNotification')) {
        return state;
      }
      return uiSlice(state, action);
    }),
  },
  stateReconciler: (inboundState: any, originalState: any, reducedState: any) => {
    // Custom state reconciliation logic if needed
    return reducedState;
  },
  migrate: (state: any) => {
    // Migration logic for persisted state
    return {
      ...state,
      // Add any new default values for missing properties
    };
  },
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'persist/PERSIST',
          'persist/REHYDRATE',
          'persist/FLUSH',
          'persist/PAUSE',
          'persist/PURGE',
          'persist/REGISTER',
        ],
        ignoredPaths: ['meta'],
      },
    }).concat(
      setupListeners({
        // Global error handling for RTK Query
        onError: (error: any, { endpoint }: any) => {
          console.error(`RTK Query error at ${endpoint}:`, error);
        },
      })
    ),
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;