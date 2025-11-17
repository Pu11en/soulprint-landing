import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface UIState {
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  notifications: Notification[];
  loading: {
    global: boolean;
    projects: boolean;
    editor: boolean;
  };
  modals: {
    projectSettings: boolean;
    exportSettings: boolean;
    assetUpload: boolean;
    confirmDelete: boolean;
  };
}

const initialState: UIState = {
  theme: 'system',
  sidebarOpen: true,
  notifications: [],
  loading: {
    global: false,
    projects: false,
    editor: false,
  },
  modals: {
    projectSettings: false,
    exportSettings: false,
    assetUpload: false,
    confirmDelete: false,
  },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.theme = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    addNotification: (state, action: PayloadAction<Notification>) => {
      state.notifications.push(action.payload);
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(
        notification => notification.id !== action.payload
      );
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.global = action.payload;
    },
    setProjectsLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.projects = action.payload;
    },
    setEditorLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.editor = action.payload;
    },
    openProjectSettings: (state) => {
      state.modals.projectSettings = true;
    },
    closeProjectSettings: (state) => {
      state.modals.projectSettings = false;
    },
    openExportSettings: (state) => {
      state.modals.exportSettings = true;
    },
    closeExportSettings: (state) => {
      state.modals.exportSettings = false;
    },
    openAssetUpload: (state) => {
      state.modals.assetUpload = true;
    },
    closeAssetUpload: (state) => {
      state.modals.assetUpload = false;
    },
    openConfirmDelete: (state) => {
      state.modals.confirmDelete = true;
    },
    closeConfirmDelete: (state) => {
      state.modals.confirmDelete = false;
    },
  },
});

export const {
  setTheme,
  toggleSidebar,
  setSidebarOpen,
  addNotification,
  removeNotification,
  clearNotifications,
  setGlobalLoading,
  setProjectsLoading,
  setEditorLoading,
  openProjectSettings,
  closeProjectSettings,
  openExportSettings,
  closeExportSettings,
  openAssetUpload,
  closeAssetUpload,
  openConfirmDelete,
  closeConfirmDelete,
} = uiSlice.actions;

export default uiSlice.reducer;
export type { UIState, Notification };