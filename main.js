// Import Firebase and config
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js";
import {
  getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDoc, doc, updateDoc,
  limit, getDocs, startAfter, writeBatch, setDoc, deleteDoc, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { FIREBASE_CONFIG } from './config.js';

// --- App Initialization ---
const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

// --- App Check Initialization ---
// TODO: Replace 'YOUR_RECAPTCHA_V3_SITE_KEY' with your actual site key from the Google reCAPTCHA admin console.
// This is a public key and is safe to be exposed in the client-side code.
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6LfPjdcrAAAAAFBVZqhaXAsFqekQhBgvKWu24rTm'),
  isTokenAutoRefreshEnabled: true
});


// --- User Identity & Settings ---
const APP_ACCESS_KEY = 'chat_app_access_v1';
const USER_ID_KEY = 'chat_user_id_v2';
const USERNAME_KEY = 'chat_username_v2';
const USER_AVATAR_KEY = 'chat_user_avatar_v1';
const FONT_SIZE_KEY = 'chat_font_size_v1';
const GLASS_MODE_KEY = 'chat_glass_mode_v1';
const SEND_WITH_ENTER_KEY = 'chat_send_with_enter_v1';
const STATIC_BACKGROUND_KEY = 'chat_background_static_v2'; // Updated key for unified background
const CREATOR_PASSWORD = '2025';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB for non-image files
const IMAGE_MAX_DIMENSION = 1280; // max width/height for compressed images
const AVATAR_MAX_DIMENSION = 200; // max width/height for avatars
const MESSAGES_PER_PAGE = 15;
const VIDEO_CALL_ROOM_ID = '_ariana_video_call_room_';
const VIDEO_CALL_ROOM_NAME = 'استدیو';
const GLOBAL_CHAT_ROOM_ID = '_ariana_global_chat_';
const GLOBAL_CHAT_ROOM_NAME = 'گفتگو';
const NUM_VIDEO_SLOTS = 6;

// --- Global State ---
let currentRoomId = null;
let currentUsername = '';
let currentUserId = localStorage.getItem(USER_ID_KEY) || `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
let currentUserAvatar = null;
let currentFontSize = 'md';
let currentGlassMode = 'off';
let currentSendWithEnter = 'on';
let currentStaticBackground = null;
let messagesUnsubscribe = null;
let userProfilesCache = {}; // Cache for user profiles { userId: { username, avatarUrl } }
let lastActiveViewId = 'chat-container'; 

// --- New Navigation/Animation State ---
let activeTab = 'chat';
let isSwitchingTabs = false;
let isInitialLoad = true;


// --- WebRTC State ---
let localStream = null;
let peerConnections = {}; // { remoteUserId: RTCPeerConnection }
let myVideoSlotId = null;
let videoCallListeners = []; // To store Firestore unsubscribers
let isMicOn = true;
let isCameraOn = true;
const stunServers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Ensure user ID is persisted
if (!localStorage.getItem(USER_ID_KEY)) {
  localStorage.setItem(USER_ID_KEY, currentUserId);
}

// --- State for Settings Modal ---
let tempStaticBackground = null;
let initialSettingsState = {};
let fileToUpload = null;

// Pagination state
let oldestMessageDoc = null;
let isLoadingOlderMessages = false;
let reachedEndOfMessages = false;

// --- DOM Elements ---
const appBackground = document.getElementById('app-background');
const globalNav = document.getElementById('global-nav');
const mainContentWrapper = document.getElementById('main-content-wrapper');
const usernameModal = document.getElementById('username-modal');
const usernameForm = document.getElementById('username-form');
const usernameInput = document.getElementById('username-input');
const initialPasswordInput = document.getElementById('initial-password-input');
const initialUserAvatarInput = document.getElementById('initial-user-avatar-input');
const initialUserAvatarPreview = document.getElementById('initial-user-avatar-preview');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const userSettingsForm = document.getElementById('user-settings-form');
const userAvatarPreview = document.getElementById('user-avatar-preview');
const userAvatarInput = document.getElementById('user-avatar-input');
const changeUsernameInput = document.getElementById('change-username-input');
const fontSizeOptions = document.getElementById('font-size-options');
const glassModeOptions = document.getElementById('glass-mode-options');
const sendWithEnterOptions = document.getElementById('send-with-enter-options');
const staticBackgroundUploader = document.getElementById('static-background-uploader');
const backgroundImageInput = document.getElementById('background-image-input');
const backgroundUploadStatus = document.getElementById('background-upload-status');
const settingsOkBtn = document.getElementById('settings-ok-btn');
const settingsCancelBtn = document.getElementById('settings-cancel-btn');
const deleteAllMessagesBtn = document.getElementById('delete-all-messages-btn');
const clearStudioCacheBtn = document.getElementById('clear-studio-cache-btn');
const updateAppBtn = document.getElementById('update-app-btn');
const updateStatusText = document.getElementById('update-status-text');
const chatContainer = document.getElementById('chat-container');
const messagesContainer = document.getElementById('messages-container');
const messagesList = document.getElementById('messages-list');
const messageInput = document.getElementById('message-input');
const fileInput = document.getElementById('file-input');
const sendButton = document.getElementById('send-button');
const loadingSpinner = document.getElementById('loading-spinner');
const scrollToBottomBtn = document.getElementById('scroll-to-bottom-btn');
const viewAvatarModal = document.getElementById('view-avatar-modal');
const viewAvatarDisplay = document.getElementById('view-avatar-display');
const viewAvatarName = document.getElementById('view-avatar-name');
const closeViewAvatarModalBtn = document.getElementById('close-view-avatar-modal');
const changeUserAvatarInChatModal = document.getElementById('change-user-avatar-in-chat-modal');
const changeUserAvatarInChatForm = document.getElementById('change-user-avatar-in-chat-form');
const userAvatarInChatPreview = document.getElementById('user-avatar-in-chat-preview');
const userAvatarInChatInput = document.getElementById('user-avatar-in-chat-input');
const changeUserAvatarInChatStatus = document.getElementById('change-user-avatar-in-chat-status');
const sendSound = document.getElementById('send-sound');
const fileConfirmModal = document.getElementById('file-confirm-modal');
const filePreviewContainer = document.getElementById('file-preview-container');
const fileConfirmStatus = document.getElementById('file-confirm-status');
const cancelFileUploadBtn = document.getElementById('cancel-file-upload');
const confirmFileUploadBtn = document.getElementById('confirm-file-upload');
const navChatBtn = document.getElementById('nav-chat-btn');
const navStudioBtn = document.getElementById('nav-studio-btn');
const videoCallContainer = document.getElementById('video-call-container');
const videoGridContainer = document.getElementById('video-grid-container');
const videoControlsBar = document.getElementById('video-controls-bar');
const toggleMicBtn = document.getElementById('toggle-mic-btn');
const toggleCameraBtn = document.getElementById('toggle-camera-btn');


// --- View Management ---
const showView = (viewId) => {
    const modals = [
        usernameModal, settingsModal, viewAvatarModal, 
        changeUserAvatarInChatModal, fileConfirmModal
    ];
    
    modals.forEach(el => el.classList.add('view-hidden'));
    
    const targetModal = document.getElementById(viewId);
    if (targetModal && modals.includes(targetModal)) {
        targetModal.classList.remove('view-hidden');
    }

    if (viewId === 'username-modal') {
        globalNav.classList.add('view-hidden');
        mainContentWrapper.classList.add('view-hidden');
    } else {
        globalNav.classList.remove('view-hidden');
        mainContentWrapper.classList.remove('view-hidden');
    }
};

const switchTab = async (tabName) => {
    if (tabName === activeTab || isSwitchingTabs) return;

    isSwitchingTabs = true;
    const previousTab = activeTab;
    activeTab = tabName;

    const studioBtn = navStudioBtn;
    const chatBtn = navChatBtn;
    
    const activeContainer = document.getElementById(`${previousTab === 'studio' ? 'video-call' : 'chat'}-container`);
    const newContainer = document.getElementById(`${tabName === 'studio' ? 'video-call' : 'chat'}-container`);

    // 1. Animate buttons
    const studioActiveClasses = ['bg-blue-500', 'text-white', 'shadow-md'];
    const studioInactiveClasses = ['bg-white/20', 'text-gray-800'];
    
    const chatActiveClasses = ['bg-blue-600', 'shadow-lg', 'scale-105'];
    const chatInactiveClasses = ['bg-transparent', 'scale-100'];

    if (tabName === 'studio') {
        studioBtn.classList.remove(...studioInactiveClasses);
        studioBtn.classList.add(...studioActiveClasses);
        chatBtn.classList.remove(...chatActiveClasses);
        chatBtn.classList.add(...chatInactiveClasses);
    } else { // chat becomes active
        chatBtn.classList.remove(...chatInactiveClasses);
        chatBtn.classList.add(...chatActiveClasses);
        studioBtn.classList.remove(...studioActiveClasses);
        studioBtn.classList.add(...studioInactiveClasses);
    }
    
    // 2. Switch containers instantly
    activeContainer.classList.add('view-hidden');
    newContainer.classList.remove('view-hidden');

    // 3. Handle room logic
    if (tabName === 'studio') {
        if (messagesUnsubscribe) {
            messagesUnsubscribe();
            messagesUnsubscribe = null;
        }
        await enterVideoCallRoom();
    } else { // chat
        if (currentRoomId === VIDEO_CALL_ROOM_ID) {
            await cleanUpVideoCall();
        }
        if (currentRoomId !== GLOBAL_CHAT_ROOM_ID) {
            const roomDoc = await getDoc(doc(db, 'rooms', GLOBAL_CHAT_ROOM_ID));
            if (roomDoc.exists()) {
                enterChatRoom(GLOBAL_CHAT_ROOM_ID, roomDoc.data());
            }
        }
    }
    
    lastActiveViewId = newContainer.id;
    setTimeout(() => { isSwitchingTabs = false; }, 50); // Shorter timeout to prevent rapid clicking issues
};

navChatBtn.addEventListener('click', () => switchTab('chat'));
navStudioBtn.addEventListener('click', () => switchTab('studio'));


// --- Helper Functions ---
const formatTime = (date) => {
  if (!date || !(date instanceof Date)) return '';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const formatDateSeparator = (date) => {
    const gregorian = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(date);
    const shamsi = new Intl.DateTimeFormat('fa-IR', { month: 'long', day: 'numeric' }).format(date);
    return `${gregorian}<br>${shamsi}`;
};

const scrollToBottom = (behavior = 'auto') => {
  messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior });
};

const avatarColors = [
    'rgba(255, 99, 132, 0.5)',  // Red
    'rgba(54, 162, 235, 0.5)',  // Blue
    'rgba(255, 206, 86, 0.5)',  // Yellow
    'rgba(75, 192, 192, 0.5)',  // Green
    'rgba(153, 102, 255, 0.5)', // Purple
    'rgba(255, 159, 64, 0.5)',  // Orange
];

const getColorForName = (name) => {
    if (!name) return 'rgba(231, 233, 237, 0.5)'; // Gray for fallback
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % avatarColors.length);
    return avatarColors[index];
};

const generateAvatar = (name, url) => {
    if (url && url !== 'null' && url !== 'undefined') {
        return `<img src="${url}" class="w-full h-full object-cover" alt="${name || 'avatar'}"/>`;
    }
    const initial = (name || '?').charAt(0).toUpperCase();
    const color = getColorForName(name);
    return `<div class="w-full h-full flex items-center justify-center text-white font-bold text-xl" style="background-color: ${color}; backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);">${initial}</div>`;
};


// --- Profile Caching ---
const getUserProfile = async (userId) => {
    // 1. Check cache first for immediate response
    if (userProfilesCache[userId]) {
        return userProfilesCache[userId];
    }

    // 2. If not in cache, fetch from Firestore
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            // 3. Store in cache for future use
            userProfilesCache[userId] = userData;
            return userData;
        }
        // Handle case where user document doesn't exist
        return { username: 'کاربر ناشناس', avatarUrl: null };
    } catch (error) {
        console.error(`Error fetching profile for user ${userId}:`, error);
        // On error (e.g., offline), return a fallback to avoid crashing.
        return { username: 'کاربر', avatarUrl: null };
    }
};

// --- Settings Logic ---
const applyFontSize = (size) => {
    document.body.classList.remove('font-size-sm', 'font-size-md', 'font-size-lg');
    document.body.classList.add(`font-size-${size}`);
    currentFontSize = size;
    // Visually update selected button
    fontSizeOptions.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('bg-green-500', btn.dataset.size === size);
        btn.classList.toggle('text-white', btn.dataset.size === size);
        btn.classList.toggle('bg-white/50', btn.dataset.size !== size);
        btn.classList.toggle('text-gray-800', btn.dataset.size !== size);
    });
};

const applyGlassModeSelection = (mode) => {
    currentGlassMode = mode;
    glassModeOptions.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('bg-green-500', btn.dataset.glass === mode);
        btn.classList.toggle('text-white', btn.dataset.glass === mode);
        btn.classList.toggle('bg-white/50', btn.dataset.glass !== mode);
        btn.classList.toggle('text-gray-800', btn.dataset.glass !== mode);
    });
};

const applySendWithEnterSelection = (value) => {
    currentSendWithEnter = value;
    sendWithEnterOptions.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('bg-green-500', btn.dataset.value === value);
        btn.classList.toggle('text-white', btn.dataset.value === value);
        btn.classList.toggle('bg-white/50', btn.dataset.value !== value);
        btn.classList.toggle('text-gray-800', btn.dataset.value !== value);
    });
};

const applyBackgroundSettings = (staticBgData) => {
    if (staticBgData) {
        appBackground.classList.remove('animated-gradient');
        appBackground.style.backgroundImage = `url(${staticBgData})`;
        appBackground.style.backgroundSize = 'cover';
        appBackground.style.backgroundPosition = 'center';
    } else {
        appBackground.style.backgroundImage = ''; // Clear inline style
        appBackground.classList.remove('animated-gradient');
    }
};

fontSizeOptions.addEventListener('click', (e) => {
    if (e.target.matches('.font-size-btn')) {
        applyFontSize(e.target.dataset.size);
    }
});

glassModeOptions.addEventListener('click', (e) => {
    if (e.target.matches('.glass-mode-btn')) {
        applyGlassModeSelection(e.target.dataset.glass);
    }
});

sendWithEnterOptions.addEventListener('click', (e) => {
    if (e.target.matches('.send-with-enter-btn')) {
        applySendWithEnterSelection(e.target.dataset.value);
    }
});

backgroundImageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    backgroundUploadStatus.textContent = 'در حال پردازش...';
    backgroundUploadStatus.className = 'text-sm text-center h-4 text-gray-600';

    try {
        tempStaticBackground = await compressImage(file, IMAGE_MAX_DIMENSION);
        applyBackgroundSettings(tempStaticBackground); // Preview
        backgroundUploadStatus.textContent = 'عکس آماده شد. برای ذخیره تایید را بزنید.';
        backgroundUploadStatus.classList.add('text-green-600');

    } catch (error) {
        console.error("Error compressing background image:", error);
        backgroundUploadStatus.textContent = 'خطا در پردازش تصویر.';
        backgroundUploadStatus.classList.add('text-red-600');
    }
});

deleteAllMessagesBtn.addEventListener('click', async () => {
    if (confirm('آیا از حذف تمام پیام‌ها در چت عمومی مطمئن هستید؟ این عمل غیرقابل بازگشت است.')) {
        const originalText = deleteAllMessagesBtn.textContent;
        settingsOkBtn.disabled = true;
        settingsCancelBtn.disabled = true;
        deleteAllMessagesBtn.disabled = true;
        clearStudioCacheBtn.disabled = true;
        deleteAllMessagesBtn.textContent = 'در حال حذف...';

        try {
            const messagesCol = collection(db, 'rooms', GLOBAL_CHAT_ROOM_ID, 'messages');
            const snapshot = await getDocs(messagesCol);
            const batch = writeBatch(db);
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            alert('تمام پیام‌ها با موفقیت حذف شدند.');
            messagesList.innerHTML = '<li class="text-center text-gray-500 p-4">هنوز پیامی در این گفتگو وجود ندارد.</li>';
        } catch (error) {
            console.error("Error deleting all messages:", error);
            alert('خطا در حذف پیام‌ها.');
        } finally {
            deleteAllMessagesBtn.textContent = originalText;
            settingsOkBtn.disabled = false;
            settingsCancelBtn.disabled = false;
            deleteAllMessagesBtn.disabled = false;
            clearStudioCacheBtn.disabled = false;
            showView(lastActiveViewId); // Close settings modal
        }
    }
});

clearStudioCacheBtn.addEventListener('click', async () => {
    if (confirm('آیا از پاکسازی تمام جایگاه‌های استدیو مطمئن هستید؟ این کار ممکن است تماس‌های فعال را قطع کند.')) {
        const originalText = clearStudioCacheBtn.textContent;
        settingsOkBtn.disabled = true;
        settingsCancelBtn.disabled = true;
        deleteAllMessagesBtn.disabled = true;
        clearStudioCacheBtn.disabled = true;
        clearStudioCacheBtn.textContent = 'در حال پاکسازی...';

        try {
            const slotsRef = collection(db, 'videoRooms', VIDEO_CALL_ROOM_ID, 'slots');
            const snapshot = await getDocs(slotsRef);
            if (snapshot.empty) {
                alert('استدیو از قبل خالی بود.');
            } else {
                const batch = writeBatch(db);
                snapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                alert('استدیو با موفقیت پاکسازی شد.');
            }
        } catch (error) {
            console.error("Error clearing studio slots:", error);
            alert('خطا در پاکسازی استدیو.');
        } finally {
            clearStudioCacheBtn.textContent = originalText;
            settingsOkBtn.disabled = false;
            settingsCancelBtn.disabled = false;
            deleteAllMessagesBtn.disabled = false;
            clearStudioCacheBtn.disabled = false;
        }
    }
});


updateAppBtn.addEventListener('click', async () => {
    const confirmation = confirm(
        'این کار تمام اطلاعات برنامه (بجز پروفایل) را پاک کرده و آن را مجدداً بارگیری می‌کند تا آخرین نسخه را دریافت کنید. آیا مطمئن هستید؟'
    );

    if (!confirmation) {
        return;
    }

    updateStatusText.textContent = 'در حال به‌روزرسانی...';
    updateStatusText.className = 'text-sm text-center h-4 text-blue-600';
    updateAppBtn.disabled = true;
    settingsOkBtn.disabled = true;
    settingsCancelBtn.disabled = true;

    try {
        // 1. Save essential user data
        const preservedUsername = localStorage.getItem(USERNAME_KEY);
        const preservedAvatar = localStorage.getItem(USER_AVATAR_KEY);
        const preservedUserId = localStorage.getItem(USER_ID_KEY);
        const preservedAccessKey = localStorage.getItem(APP_ACCESS_KEY);

        // 2. Unregister all service workers
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
            }
        }

        // 3. Clear all caches
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(key => caches.delete(key)));

        // 4. Clear localStorage
        localStorage.clear();

        // 5. Restore essential user data
        if (preservedUsername) localStorage.setItem(USERNAME_KEY, preservedUsername);
        if (preservedAvatar) localStorage.setItem(USER_AVATAR_KEY, preservedAvatar);
        if (preservedUserId) localStorage.setItem(USER_ID_KEY, preservedUserId);
        if (preservedAccessKey) localStorage.setItem(APP_ACCESS_KEY, preservedAccessKey);
        
        // 6. Reload the page from the server
        window.location.reload(true);

    } catch (error) {
        console.error('Hard update failed:', error);
        updateStatusText.textContent = 'به‌روزرسانی ناموفق بود. لطفاً صفحه را رفرش کنید.';
        updateStatusText.className = 'text-sm text-center h-4 text-red-500';
        updateAppBtn.disabled = false;
        settingsOkBtn.disabled = false;
        settingsCancelBtn.disabled = false;
    }
});

settingsBtn.addEventListener('click', () => {
    initialSettingsState = {
        staticBg: currentStaticBackground
    };
    
    changeUsernameInput.value = currentUsername;
    userAvatarPreview.innerHTML = generateAvatar(currentUsername, currentUserAvatar);
    applyFontSize(currentFontSize);
    applyGlassModeSelection(currentGlassMode);
    applySendWithEnterSelection(currentSendWithEnter);
    
    tempStaticBackground = null;
    backgroundImageInput.value = '';
    backgroundUploadStatus.textContent = '';
    updateStatusText.textContent = '';


    showView('settings-modal');
});

settingsCancelBtn.addEventListener('click', () => {
    applyBackgroundSettings(initialSettingsState.staticBg);
    showView(lastActiveViewId);
});


userAvatarInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const compressedAvatar = await compressImage(file, AVATAR_MAX_DIMENSION);
        currentUserAvatar = compressedAvatar;
        userAvatarPreview.innerHTML = generateAvatar(currentUsername, currentUserAvatar);
    } catch (error) {
        console.error("Error compressing avatar:", error);
        alert("خطا در پردازش تصویر.");
    }
});

userSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newUsername = changeUsernameInput.value.trim();
    const userUpdates = {};

    if (newUsername && newUsername !== currentUsername) {
        currentUsername = newUsername;
        localStorage.setItem(USERNAME_KEY, newUsername);
        userUpdates.username = newUsername;
    }
    
    userUpdates.avatarUrl = currentUserAvatar || null;
    localStorage.setItem(USER_AVATAR_KEY, currentUserAvatar || '');

    localStorage.setItem(FONT_SIZE_KEY, currentFontSize);
    localStorage.setItem(GLASS_MODE_KEY, currentGlassMode);
    localStorage.setItem(SEND_WITH_ENTER_KEY, currentSendWithEnter);
    
    if (tempStaticBackground) {
        try {
            await setDoc(doc(db, 'app_settings', 'global'), { backgroundUrl: tempStaticBackground }, { merge: true });
        } catch (error) { console.error("Error updating global background:", error); }
    }

    if (Object.keys(userUpdates).length > 0) {
        try {
            await setDoc(doc(db, 'users', currentUserId), userUpdates, { merge: true });
            userProfilesCache[currentUserId] = { username: currentUsername, avatarUrl: currentUserAvatar };
             // If user is in a video slot, update their avatar there too for real-time sync
            if (myVideoSlotId) {
                const slotRef = doc(db, 'videoRooms', VIDEO_CALL_ROOM_ID, 'slots', `slot_${myVideoSlotId}`);
                await updateDoc(slotRef, { occupantAvatar: currentUserAvatar });
            }
        } catch (error) { console.error("Error syncing user settings:", error); }
    }
    
    showView(lastActiveViewId);
});

// --- Chat Room Logic ---
const enterChatRoom = (roomId, roomData) => {
  currentRoomId = roomId;
  
  messagesList.innerHTML = '';
  oldestMessageDoc = null;
  isLoadingOlderMessages = false;
  reachedEndOfMessages = false;
  scrollToBottomBtn.classList.add('view-hidden', 'opacity-0');
  
  if (messagesUnsubscribe) messagesUnsubscribe();

  loadAndListenForMessages();
};

const loadAndListenForMessages = () => {
    const messagesCol = collection(db, 'rooms', currentRoomId, 'messages');
    const q = query(messagesCol, orderBy('timestamp', 'desc'), limit(MESSAGES_PER_PAGE));

    messagesUnsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty && messagesList.children.length === 0) {
            messagesList.innerHTML = '<li class="text-center text-gray-500 p-4">هنوز پیامی در این گفتگو وجود ندارد.</li>';
            reachedEndOfMessages = true;
            oldestMessageDoc = null;
            return;
        }

        const isInitialLoad = !oldestMessageDoc;

        if (isInitialLoad) {
            const messages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() ?? new Date(),
            })).reverse();
            renderMessages(messages, false, true);
        } else {
            const newMessages = [];
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const messageId = change.doc.id;
                    if (!messagesList.querySelector(`li[data-message-id="${messageId}"]`)) {
                        newMessages.push({
                            id: messageId,
                            ...change.doc.data(),
                            timestamp: change.doc.data().timestamp?.toDate() ?? new Date(),
                        });
                    }
                }
            });

            if (newMessages.length > 0) {
                newMessages.sort((a, b) => a.timestamp - b.timestamp);
                renderMessages(newMessages, false, false);
            }
        }

        if (snapshot.docs.length > 0) {
            oldestMessageDoc = snapshot.docs[snapshot.docs.length - 1];
        } else {
            reachedEndOfMessages = true;
        }
    }, error => {
        console.error("Error listening to messages:", error);
        messagesList.innerHTML = '<li class="text-center text-red-500 p-4">خطا در بارگذاری پیام‌ها.</li>';
    });
};

const loadOlderMessages = async () => {
  if (isLoadingOlderMessages || reachedEndOfMessages || !oldestMessageDoc) return;
  isLoadingOlderMessages = true;
  loadingSpinner.classList.remove('hidden');
  const messagesCol = collection(db, 'rooms', currentRoomId, 'messages');
  const q = query(messagesCol, orderBy('timestamp', 'desc'), startAfter(oldestMessageDoc), limit(MESSAGES_PER_PAGE));
  try {
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      reachedEndOfMessages = true;
      loadingSpinner.classList.add('hidden');
      return;
    }
    const oldMessages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() ?? new Date(),
    })).reverse();
    oldestMessageDoc = snapshot.docs[snapshot.docs.length - 1];
    const firstMessage = messagesList.firstChild;
    const currentScrollHeight = messagesContainer.scrollHeight;
    await renderMessages(oldMessages, true);
    messagesContainer.scrollTop = messagesContainer.scrollHeight - currentScrollHeight;
  } catch(error) {
    console.error("Error loading older messages:", error);
  } finally {
    isLoadingOlderMessages = false;
    loadingSpinner.classList.add('hidden');
  }
};

messagesContainer.addEventListener('scroll', () => {
  if (messagesContainer.scrollTop < 50) { loadOlderMessages(); }
  const isScrolledUp = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight > 200;
  scrollToBottomBtn.classList.remove('view-hidden');
  scrollToBottomBtn.classList.toggle('opacity-0', !isScrolledUp);
});
scrollToBottomBtn.addEventListener('click', () => { scrollToBottom('smooth'); });

const renderMessages = async (messages, prepend = false, isInitialLoad = false) => {
  if (!prepend && messagesList.innerHTML.includes('هنوز پیامی')) { messagesList.innerHTML = ''; }
  const fragment = document.createDocumentFragment();

  const authorIds = [...new Set(messages.map(m => m.authorId).filter(id => !userProfilesCache[id]))];
  if(authorIds.length > 0) {
    await Promise.all(authorIds.map(id => getUserProfile(id)));
  }

  const glassModeClasses = {
      'off': { user: 'bg-green-500', other: 'bg-white' },
      'low': { user: 'bg-green-500/70', other: 'bg-white/70' },
      'high': { user: 'bg-green-500/40', other: 'bg-white/40' }
  };
  const selectedModeClasses = glassModeClasses[currentGlassMode] || glassModeClasses['off'];

  let lastDateStrInBatch = null;
  let lastAuthorIdForMargin = null;

  if (prepend) {
      const firstOldMessageOnScreenEl = messagesList.querySelector('li[data-timestamp]');
      if (firstOldMessageOnScreenEl) {
          const lastNewMessage = messages[messages.length - 1];
          const firstOldMessageDateStr = new Date(parseInt(firstOldMessageOnScreenEl.dataset.timestamp)).toDateString();
          if (lastNewMessage && lastNewMessage.timestamp?.toDateString() === firstOldMessageDateStr) {
              const separator = firstOldMessageOnScreenEl.previousElementSibling;
              if (separator && separator.classList.contains('date-separator')) {
                  separator.remove();
              }
          }
      }
  } else {
      const allVisibleMsgs = messagesList.querySelectorAll('li[data-timestamp]');
      if (allVisibleMsgs.length > 0) {
          const lastVisibleMsg = allVisibleMsgs[allVisibleMsgs.length - 1];
          lastDateStrInBatch = new Date(parseInt(lastVisibleMsg.dataset.timestamp)).toDateString();
          const lastMsgAuthorEl = messagesList.querySelector('li[data-author-id]:last-child');
          if (lastMsgAuthorEl) {
            lastAuthorIdForMargin = lastMsgAuthorEl.dataset.authorId;
          }
      }
  }

  for (const message of messages) {
      if (!message.timestamp) continue;
      const messageDateStr = message.timestamp.toDateString();

      if (messageDateStr !== lastDateStrInBatch) {
          const li = document.createElement('li');
          li.className = 'date-separator text-center my-3';
          li.innerHTML = `<span class="inline-block bg-gray-400/30 backdrop-blur-sm text-gray-700 text-xs font-semibold rounded-full px-3 py-1 text-center whitespace-nowrap">${formatDateSeparator(message.timestamp)}</span>`;
          fragment.appendChild(li);
          lastDateStrInBatch = messageDateStr;
          lastAuthorIdForMargin = null; // Reset author on new day
      }

      const isUser = message.authorId === currentUserId;
      const authorProfile = userProfilesCache[message.authorId] || { username: 'کاربر', avatarUrl: null };
      
      const li = document.createElement('li');
      li.dataset.authorId = message.authorId;
      li.dataset.timestamp = message.timestamp.getTime();
      li.dataset.messageId = message.id;
      
      let bubbleClasses, bubbleTailClass, nameAlignmentClass, nameColorClass, timeColorClass, liClasses;
      
      const senderName = (authorProfile.username || 'کاربر').replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const authorAvatarForRender = authorProfile.avatarUrl;
      const avatarHTML = generateAvatar(senderName, authorAvatarForRender);
      const avatarContainer = `<div class="message-avatar w-10 h-10 flex-shrink-0 rounded-full overflow-hidden self-end bg-white/30 backdrop-blur-sm cursor-pointer" data-author-id="${message.authorId}" data-author-name="${senderName}" data-author-avatar-url="${authorAvatarForRender || ''}">${avatarHTML}</div>`;

      if (isUser) { // User's messages on the RIGHT
          liClasses = 'justify-start'; // Aligns to the right in RTL
          bubbleClasses = `${selectedModeClasses.user} text-white`;
          bubbleTailClass = 'rounded-br-none';
          nameAlignmentClass = 'text-right pr-1';
          nameColorClass = 'text-gray-200/90';
          timeColorClass = 'text-gray-200/90';
      } else { // Others' messages on the LEFT
          liClasses = 'justify-end';
          bubbleClasses = `${selectedModeClasses.other} text-black shadow`;
          bubbleTailClass = 'rounded-bl-none';
          nameAlignmentClass = 'text-left pl-1';
          nameColorClass = 'text-gray-500 opacity-70';
          timeColorClass = 'text-gray-500 opacity-70';
      }
      
      const isConsecutive = message.authorId === lastAuthorIdForMargin;
      const marginClass = isConsecutive ? 'mb-1' : 'mb-2';
      
      li.className = `flex items-start space-x-3 rtl:space-x-reverse ${marginClass} ${liClasses}`;
      const nameHTML = !isUser ? `<div class="text-xs ${nameColorClass} ${nameAlignmentClass} leading-tight pt-1">${senderName}</div>` : '';

      let messageContentHTML = '';

      switch (message.type) {
        case 'image':
          messageContentHTML = `<div class="relative rounded-lg overflow-hidden"><img src="${message.fileDataUrl}" class="max-w-full h-auto" style="max-height: 300px; min-width: 150px;" alt="${message.fileName || 'Image'}"/><div class="absolute bottom-1 right-2 text-xs text-white bg-black/30 rounded px-1 flex items-center gap-1" dir="ltr">${formatTime(message.timestamp)}</div></div>`;
          break;
        case 'file':
          const fileName = (message.fileName || 'فایل').replace(/</g, "&lt;").replace(/>/g, "&gt;");
          const timeHTML = `<span class="text-[11px]" dir="ltr">${formatTime(message.timestamp)}</span>`;
          const fileMetaHTML = `<div class="absolute bottom-1.5 ${isUser ? 'left-2.5' : 'right-2.5'} flex items-center gap-1 text-gray-700">${timeHTML}</div>`;
          messageContentHTML = `<a href="${message.fileDataUrl}" download="${fileName}" class="relative flex items-center space-x-2 rtl:space-x-reverse bg-gray-100/30 backdrop-blur-sm p-3 rounded-lg hover:bg-gray-100/50 min-w-[180px]"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8 flex-shrink-0 text-gray-600"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg><span class="font-medium text-sm text-gray-800 break-all">${fileName}</span>${fileMetaHTML}</a>`;
          break;
        default: // text
          const textContent = (message.text || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
          const timeHTMLSpan = `<span class="text-[11px] ${timeColorClass} leading-tight" dir="ltr">${formatTime(message.timestamp)}</span>`;
          const timeAlignmentClass = isUser ? 'text-left pl-1.5' : 'text-right pr-1.5';

          messageContentHTML = `
            <div class="px-2 py-0.5 rounded-2xl ${bubbleClasses} ${bubbleTailClass} backdrop-blur-md flex flex-col">
              ${nameHTML}
              <p class="whitespace-pre-wrap break-words break-all message-text self-stretch m-0">${textContent}</p>
              <div class="w-full ${timeAlignmentClass} -mt-1 pb-0.5">${timeHTMLSpan}</div>
            </div>`;
      }
      
      const bubbleContainer = `<div class="flex flex-col max-w-xs lg:max-w-md">${messageContentHTML}</div>`;

      if (isUser) {
          li.innerHTML = avatarContainer + bubbleContainer;
      } else {
          li.innerHTML = bubbleContainer + avatarContainer;
      }
      fragment.appendChild(li);
      lastAuthorIdForMargin = message.authorId;
  }
  
  if (prepend && messages.length > 0) {
    const firstOldMessageOnScreen = messagesList.querySelector('li[data-author-id]');
    if (firstOldMessageOnScreen && firstOldMessageOnScreen.dataset.authorId === lastAuthorIdForMargin) {
        const lastNewTimestamp = messages[messages.length - 1].timestamp;
        const firstOldTimestamp = new Date(parseInt(firstOldMessageOnScreen.dataset.timestamp));
        if (lastNewTimestamp.toDateString() === firstOldTimestamp.toDateString()) {
            firstOldMessageOnScreen.classList.remove('mb-2');
            firstOldMessageOnScreen.classList.add('mb-1');
        }
    }
  }


  if (prepend) { messagesList.prepend(fragment); } else { messagesList.appendChild(fragment); }
  if (isInitialLoad || !prepend) { setTimeout(() => scrollToBottom(), 50); }
};

// --- Avatar Click Logic ---
const showUserAvatar = (name, url) => {
    viewAvatarName.textContent = name || 'کاربر';
    viewAvatarDisplay.innerHTML = generateAvatar(name, url);
    showView('view-avatar-modal');
};

messagesList.addEventListener('click', (e) => {
    const avatarEl = e.target.closest('.message-avatar');
    if (!avatarEl) return;
    
    const authorId = avatarEl.dataset.authorId;
    const authorName = avatarEl.dataset.authorName;
    const authorAvatarUrl = avatarEl.dataset.authorAvatarUrl;

    if (authorId === currentUserId) {
        changeUserAvatarInChatForm.reset();
        userAvatarInChatPreview.innerHTML = generateAvatar(currentUsername, currentUserAvatar);
        changeUserAvatarInChatStatus.textContent = '';
        showView('change-user-avatar-in-chat-modal');
    } else {
        showUserAvatar(authorName, authorAvatarUrl);
    }
});

closeViewAvatarModalBtn.addEventListener('click', () => showView(lastActiveViewId));
document.querySelector('#change-user-avatar-in-chat-modal .cancel-btn').addEventListener('click', () => showView(lastActiveViewId));

userAvatarInChatInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        userAvatarInChatPreview.innerHTML = `<img src="${URL.createObjectURL(file)}" class="w-full h-full object-cover"/>`;
    }
});

changeUserAvatarInChatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = userAvatarInChatInput.files[0];
    if (!file) { alert("لطفا یک عکس انتخاب کنید."); return; }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    changeUserAvatarInChatStatus.textContent = 'در حال ذخیره...';
    changeUserAvatarInChatStatus.classList.remove('text-red-600', 'text-green-600');
    try {
        const compressedAvatar = await compressImage(file, AVATAR_MAX_DIMENSION);
        currentUserAvatar = compressedAvatar;
        localStorage.setItem(USER_AVATAR_KEY, currentUserAvatar || '');
        
        await setDoc(doc(db, 'users', currentUserId), { avatarUrl: currentUserAvatar }, { merge: true });
        userProfilesCache[currentUserId] = { ...userProfilesCache[currentUserId], avatarUrl: currentUserAvatar };
        
        if (myVideoSlotId) {
            const slotRef = doc(db, 'videoRooms', VIDEO_CALL_ROOM_ID, 'slots', `slot_${myVideoSlotId}`);
            await updateDoc(slotRef, { occupantAvatar: currentUserAvatar });
        }

        document.querySelectorAll(`.message-avatar[data-author-id="${currentUserId}"]`).forEach(el => {
            el.innerHTML = generateAvatar(currentUsername, currentUserAvatar);
            el.dataset.authorAvatarUrl = currentUserAvatar || '';
        });

        changeUserAvatarInChatStatus.textContent = 'عکس با موفقیت ذخیره شد.';
        changeUserAvatarInChatStatus.classList.add('text-green-600');
        setTimeout(() => showView(lastActiveViewId), 1500);

    } catch(error) {
        console.error("Error changing user avatar in chat:", error);
        changeUserAvatarInChatStatus.textContent = 'خطا در ذخیره عکس.';
        changeUserAvatarInChatStatus.classList.add('text-red-600');
    } finally {
        submitBtn.disabled = false;
    }
});


// --- File Handling & Image Compression ---
const compressImage = (file, maxDimension) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > height) {
                    if (width > maxDimension) { height *= maxDimension / width; width = maxDimension; }
                } else {
                    if (height > maxDimension) { width *= maxDimension / height; height = maxDimension; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = reject;
            img.src = event.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentRoomId) return;

    fileToUpload = file;
    fileInput.value = '';

    filePreviewContainer.innerHTML = '';
    fileConfirmStatus.textContent = 'برای ارسال تایید کنید.';
    fileConfirmStatus.className = 'text-sm text-center h-4 mb-4 text-gray-700';

    if (file.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(file);
        filePreviewContainer.innerHTML = `<img src="${previewUrl}" class="max-w-full max-h-full object-contain" alt="Preview"/>`;
    } else {
        filePreviewContainer.innerHTML = `
            <div class="text-center text-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-16 h-16 mx-auto text-gray-500"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                <p class="font-semibold mt-2 break-all">${file.name}</p>
            </div>
        `;
    }

    showView('file-confirm-modal');
};

const uploadConfirmedFile = async () => {
    if (!fileToUpload || !currentRoomId) return;

    const file = fileToUpload;
    const isImage = file.type.startsWith('image/');
    let fileDataUrl;
    
    confirmFileUploadBtn.disabled = true;
    cancelFileUploadBtn.disabled = true;
    fileConfirmStatus.textContent = 'در حال ارسال...';
    
    const tempId = `temp_${Date.now()}`;
    if (isImage) {
        const previewUrl = URL.createObjectURL(file);
        const tempLi = document.createElement('li');
        tempLi.id = tempId;
        tempLi.className = 'flex items-start space-x-3 rtl:space-x-reverse mb-2 justify-start opacity-50';
        tempLi.innerHTML = `
            <div class="message-avatar w-10 h-10 flex-shrink-0 rounded-full overflow-hidden self-end bg-white/30 backdrop-blur-sm">${generateAvatar(currentUsername, currentUserAvatar)}</div>
            <div class="flex flex-col max-w-xs lg:max-w-md">
                <div class="relative rounded-lg overflow-hidden">
                    <img src="${previewUrl}" class="max-w-full h-auto" style="max-height: 300px;" />
                    <div class="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <svg class="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    </div>
                </div>
            </div>`;
        messagesList.appendChild(tempLi);
        scrollToBottom('smooth');
    }

    try {
        if (isImage) {
            fileDataUrl = await compressImage(file, IMAGE_MAX_DIMENSION);
        } else {
            if (file.size > MAX_FILE_SIZE) { 
                fileConfirmStatus.textContent = `حجم فایل نباید بیشتر از 5 مگابایت باشد.`;
                fileConfirmStatus.classList.add('text-red-600');
                fileToUpload = null;
                confirmFileUploadBtn.disabled = false;
                cancelFileUploadBtn.disabled = false;
                return;
             }
            fileDataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = e => reject(e);
                reader.readAsDataURL(file);
            });
        }
        const messagesCol = collection(db, 'rooms', currentRoomId, 'messages');
        await addDoc(messagesCol, { type: isImage ? 'image' : 'file', fileName: file.name, fileDataUrl, authorId: currentUserId, authorName: currentUsername, authorAvatar: currentUserAvatar, timestamp: serverTimestamp() });
        showView(lastActiveViewId);
        setTimeout(() => scrollToBottom('smooth'), 150);
    } catch (error) { 
        console.error("Error processing/uploading file:", error); 
        fileConfirmStatus.textContent = 'خطا در ارسال فایل.';
        fileConfirmStatus.classList.add('text-red-600');
    } finally {
        if (isImage) {
            const tempEl = document.getElementById(tempId);
            if(tempEl) tempEl.remove();
        }
        fileToUpload = null;
        confirmFileUploadBtn.disabled = false;
        cancelFileUploadBtn.disabled = false;
    }
};

fileInput.addEventListener('change', handleFileSelect);
cancelFileUploadBtn.addEventListener('click', () => {
    fileToUpload = null;
    showView(lastActiveViewId);
});
confirmFileUploadBtn.addEventListener('click', uploadConfirmedFile);

// --- Event Listeners & App Flow ---
initialUserAvatarInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            initialUserAvatarPreview.innerHTML = `<img src="${event.target.result}" class="w-full h-full object-cover" />`;
        };
        reader.readAsDataURL(file);
    }
});


usernameForm.addEventListener('submit', async (e) => { 
    e.preventDefault(); 
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    const newUsername = usernameInput.value.trim(); 
    const password = initialPasswordInput.value;
    const avatarFile = initialUserAvatarInput.files[0];

    if (password !== CREATOR_PASSWORD) {
        alert('رمز ورود به برنامه اشتباه است.');
        initialPasswordInput.value = '';
        initialPasswordInput.focus();
        submitBtn.disabled = false;
        return;
    }

    if (newUsername) { 
        try {
            let compressedAvatar = null;
            if (avatarFile) {
                compressedAvatar = await compressImage(avatarFile, AVATAR_MAX_DIMENSION);
            }
            
            localStorage.setItem(APP_ACCESS_KEY, 'true');
            localStorage.setItem(USERNAME_KEY, newUsername);
            localStorage.setItem(USER_AVATAR_KEY, compressedAvatar || '');

            await setDoc(doc(db, 'users', currentUserId), { 
                username: newUsername,
                avatarUrl: compressedAvatar 
            }, { merge: true });

            startApp(); 
        } catch (error) {
            console.error("Error processing avatar or creating user:", error);
            alert('خطا در پردازش عکس یا ساخت کاربر.');
            submitBtn.disabled = false;
        }
    } else {
        submitBtn.disabled = false;
    }
});

const updateSendButtonState = () => {
    const hasText = messageInput.value.trim().length > 0; 
    sendButton.disabled = !hasText;
};

const sendMessage = async () => {
    const text = messageInput.value.trim();
    if (!text || !currentRoomId) return;

    const tempInput = messageInput.value;
    messageInput.value = '';
    updateSendButtonState();
    messageInput.focus();

    try {
        const messagesCol = collection(db, 'rooms', currentRoomId, 'messages');
        await addDoc(messagesCol, { type: 'text', text, authorId: currentUserId, authorName: currentUsername, authorAvatar: currentUserAvatar, timestamp: serverTimestamp() });
        sendSound.play().catch(err => console.error("Audio play failed:", err));
    } catch (error) {
        console.error("Error sending message:", error);
        messageInput.value = tempInput;
        updateSendButtonState();
    }
};

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('input', updateSendButtonState);
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && currentSendWithEnter === 'on') {
        e.preventDefault();
        sendMessage();
    }
});

// --- Video Call Logic ---
const resetVideoSlot = (slotEl) => {
    if(!slotEl) return;
    const video = slotEl.querySelector('video');
    if (video && video.srcObject) {
        // Don't stop tracks, just clear the srcObject
        // The stream might be needed elsewhere if it's a remote stream
        video.srcObject = null;
    }
    slotEl.querySelector('.video-feed').classList.add('hidden');
    slotEl.querySelector('.avatar-placeholder').classList.add('hidden');
    slotEl.querySelector('.empty-placeholder').classList.remove('hidden');
    slotEl.querySelector('.name-pill').textContent = '';
    delete slotEl.dataset.occupantId;
};

const findAndJoinEmptySlot = async () => {
    const slotsRef = collection(db, 'videoRooms', VIDEO_CALL_ROOM_ID, 'slots');
    const slotsSnapshot = await getDocs(slotsRef);
    const occupiedSlots = new Set(slotsSnapshot.docs.map(d => parseInt(d.id.split('_')[1])));
    
    let targetSlotId = -1;
    const hasMedia = !!localStream;

    // Users with media can join any slot, prioritizing large ones.
    // Users without media can only join small slots.
    const searchOrder = hasMedia ? [1, 2, 3, 4, 5, 6] : [3, 4, 5, 6];
    
    for (const id of searchOrder) {
        if (!occupiedSlots.has(id)) {
            targetSlotId = id;
            break;
        }
    }
  
    if (targetSlotId !== -1) {
        await joinVideoSlot(targetSlotId);
    } else {
      alert("استدیو تماس پر است یا جای خالی مناسب شما وجود ندارد.");
      switchTab('chat');
    }
};

const enterVideoCallRoom = async () => {
    currentRoomId = VIDEO_CALL_ROOM_ID;
    initializeVideoUI();
    setupVideoCallListeners();

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        isMicOn = true;
        isCameraOn = true;
        toggleMicBtn.disabled = false;
        toggleCameraBtn.disabled = false;
        toggleMicBtn.classList.add('bg-green-500/80');
        toggleCameraBtn.classList.add('bg-green-500/80');
        toggleMicBtn.classList.remove('bg-white/40');
        toggleCameraBtn.classList.remove('bg-white/40');
    } catch (err) {
        console.error("Error accessing media devices. Joining without media.", err);
        localStream = null;
        isMicOn = false;
        isCameraOn = false;
        toggleMicBtn.disabled = true;
        toggleCameraBtn.disabled = true;
    }
    await findAndJoinEmptySlot();
};

const initializeVideoUI = () => {
  document.querySelectorAll('.video-slot').forEach((slot, index) => {
    const slotId = index + 1;
    if (slot.innerHTML.trim() === '') { // Only initialize if empty
        slot.innerHTML = `
        <div class="relative w-full h-full bg-white/10 backdrop-blur-3xl rounded-2xl overflow-hidden flex items-center justify-center">
            <video class="video-feed w-full h-full object-cover hidden transform -scale-x-100" autoplay playsinline></video>
            <div class="avatar-placeholder absolute inset-0 w-full h-full hidden flex items-center justify-center"></div>
            <div class="empty-placeholder absolute inset-0 flex flex-col items-center justify-center cursor-pointer transition-opacity duration-300 hover:bg-black/10">
            <svg class="w-1/4 h-1/4 max-w-[64px] max-h-[64px] text-gray-400/80"><use href="#placeholder-person-svg" /></svg>
            <span class="text-white/70 text-sm mt-2 font-semibold">متصل شوید</span>
            </div>
            <div class="name-pill absolute bottom-2 right-2 px-3 py-0.5 bg-black/30 backdrop-blur-lg text-white text-[10px] font-semibold rounded-full whitespace-nowrap"></div>
        </div>
        `;
        slot.querySelector('.empty-placeholder').addEventListener('click', () => {
            joinVideoSlot(slotId);
        });
    }
  });
  
  toggleMicBtn.disabled = true;
  toggleCameraBtn.disabled = true;
  toggleMicBtn.classList.remove('bg-green-500/80');
  toggleCameraBtn.classList.remove('bg-green-500/80');
  toggleMicBtn.classList.add('bg-white/40');
  toggleCameraBtn.classList.add('bg-white/40');
};

const joinVideoSlot = async (slotId) => {
    if (myVideoSlotId === slotId) return;

    if (!localStream && slotId <= 2) {
        alert('برای استفاده از کادرهای بزرگ نیاز به دسترسی دوربین و میکروفون دارید.');
        return;
    }

    const oldSlotId = myVideoSlotId;
    myVideoSlotId = slotId;

    // --- Update UI immediately ---
    const newSlotEl = document.getElementById(`video-slot-${slotId}`);
    
    // Update new slot UI
    if (localStream) {
        const videoEl = newSlotEl.querySelector('video');
        videoEl.srcObject = localStream;
        videoEl.muted = true;
        newSlotEl.querySelector('.video-feed').classList.remove('hidden