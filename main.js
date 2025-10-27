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
const STATIC_BACKGROUND_KEY = 'chat_background_static_v2';
const CREATOR_PASSWORD = '2025';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const IMAGE_MAX_DIMENSION = 1280;
const AVATAR_MAX_DIMENSION = 200;
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
let userProfilesCache = {};
let lastActiveViewId = 'home-container';
let activeMainView = 'home';

// --- WebRTC State ---
let localStream = null;
let peerConnections = {};
let myVideoSlotId = null;
let videoCallListeners = [];
let isMicOn = true;
let isCameraOn = true;
const stunServers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

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
const mainContentWrapper = document.getElementById('main-content-wrapper');
const usernameModal = document.getElementById('username-modal');
const usernameForm = document.getElementById('username-form');
const usernameInput = document.getElementById('username-input');
const initialPasswordInput = document.getElementById('initial-password-input');
const initialUserAvatarInput = document.getElementById('initial-user-avatar-input');
const initialUserAvatarPreview = document.getElementById('initial-user-avatar-preview');
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
const homeContainer = document.getElementById('home-container');
const chatListContainer = document.getElementById('chat-list-container');
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
const navChatsBtn = document.getElementById('nav-chats-btn');
const navStudioBtn = document.getElementById('nav-studio-btn');
const navSettingsBtn = document.getElementById('nav-settings-btn');
const videoCallContainer = document.getElementById('video-call-container');
const videoGridContainer = document.getElementById('video-grid-container');
const videoControlsBar = document.getElementById('video-controls-bar');
const toggleMicBtn = document.getElementById('toggle-mic-btn');
const toggleCameraBtn = document.getElementById('toggle-camera-btn');
const backToHomeBtn = document.getElementById('back-to-home-btn');
const backToHomeFromVideoBtn = document.getElementById('back-to-home-from-video-btn');

// --- View Management ---
const showModal = (modalId) => {
    const modals = [usernameModal, settingsModal, viewAvatarModal, changeUserAvatarInChatModal, fileConfirmModal];
    modals.forEach(el => el.classList.add('view-hidden'));
    const targetModal = document.getElementById(modalId);
    if (targetModal) {
        targetModal.classList.remove('view-hidden');
    }
};

const hideAllModals = () => {
    [usernameModal, settingsModal, viewAvatarModal, changeUserAvatarInChatModal, fileConfirmModal].forEach(el => el.classList.add('view-hidden'));
};

const showMainView = async (view) => {
    if (activeMainView === view) return;

    const previousView = activeMainView;
    activeMainView = view;

    // Handle cleanup for leaving views
    if (previousView === 'studio') {
        await cleanUpVideoCall();
    }
    if (previousView === 'chat') {
        if (messagesUnsubscribe) {
            messagesUnsubscribe();
            messagesUnsubscribe = null;
        }
    }

    // Hide all main views
    [homeContainer, chatContainer, videoCallContainer].forEach(c => c.classList.add('view-hidden'));

    // Show the target view and run setup logic
    if (view === 'home') {
        homeContainer.classList.remove('view-hidden');
        renderHomeScreen();
    } else if (view === 'chat') {
        chatContainer.classList.remove('view-hidden');
        const roomDoc = await getDoc(doc(db, 'rooms', GLOBAL_CHAT_ROOM_ID));
        if (roomDoc.exists()) {
            enterChatRoom(GLOBAL_CHAT_ROOM_ID, roomDoc.data());
        }
    } else if (view === 'studio') {
        videoCallContainer.classList.remove('view-hidden');
        await enterVideoCallRoom();
    }
    
    updateBottomNavUI(view);
};

const updateBottomNavUI = (activeView) => {
    const btnMap = {
        home: navChatsBtn,
        chat: navChatsBtn,
        studio: navStudioBtn,
        settings: navSettingsBtn
    };
    const activeBtn = btnMap[activeView];

    document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
        const text = btn.querySelector('.nav-text');
        const svg = btn.querySelector('svg');
        if (btn === activeBtn) {
            btn.classList.add('bg-blue-500', 'text-white');
            btn.classList.remove('text-gray-500');
            btn.style.flex = '2'; // Grow more
            text.classList.remove('hidden');
            svg.classList.add('text-white');
            svg.classList.remove('text-gray-500');
        } else {
            btn.classList.remove('bg-blue-500', 'text-white');
            btn.classList.add('text-gray-500');
            btn.style.flex = '1';
            text.classList.add('hidden');
            svg.classList.remove('text-white');
            svg.classList.add('text-gray-500');
        }
    });
};


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
    if (userProfilesCache[userId]) {
        return userProfilesCache[userId];
    }
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            userProfilesCache[userId] = userData;
            return userData;
        }
        return { username: 'کاربر ناشناس', avatarUrl: null };
    } catch (error) {
        console.error(`Error fetching profile for user ${userId}:`, error);
        return { username: 'کاربر', avatarUrl: null };
    }
};

// --- Settings Logic ---
const applyFontSize = (size) => {
    document.body.classList.remove('font-size-sm', 'font-size-md', 'font-size-lg');
    document.body.classList.add(`font-size-${size}`);
    currentFontSize = size;
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
        appBackground.style.backgroundImage = `url(${staticBgData})`;
        appBackground.style.backgroundSize = 'cover';
        appBackground.style.backgroundPosition = 'center';
    } else {
        appBackground.style.backgroundImage = 'linear-gradient(180deg, #F0F7FF 0%, #FFFFFF 60%)';
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
        applyBackgroundSettings(tempStaticBackground);
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
        // ... (rest of the function is unchanged)
    }
});

clearStudioCacheBtn.addEventListener('click', async () => {
    if (confirm('آیا از پاکسازی تمام جایگاه‌های استدیو مطمئن هستید؟ این کار ممکن است تماس‌های فعال را قطع کند.')) {
        // ... (rest of the function is unchanged)
    }
});

updateAppBtn.addEventListener('click', async () => {
    // ... (rest of the function is unchanged)
});

settingsCancelBtn.addEventListener('click', () => {
    applyBackgroundSettings(initialSettingsState.staticBg);
    hideAllModals();
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
            if (myVideoSlotId) {
                const slotRef = doc(db, 'videoRooms', VIDEO_CALL_ROOM_ID, 'slots', `slot_${myVideoSlotId}`);
                await updateDoc(slotRef, { occupantAvatar: currentUserAvatar });
            }
        } catch (error) { console.error("Error syncing user settings:", error); }
    }
    
    hideAllModals();
});

// --- Home Screen Logic ---
const renderHomeScreen = () => {
    chatListContainer.innerHTML = `
        <div class="mb-4">
            <h3 class="font-bold text-gray-800 mb-2">All Chats</h3>
            <div id="global-chat-item" class="flex items-center p-3 rounded-2xl cursor-pointer hover:bg-gray-100 transition-colors">
                <div class="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 mr-4 rtl:mr-0 rtl:ml-4 bg-blue-200">
                    ${generateAvatar(GLOBAL_CHAT_ROOM_NAME, null)}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-center">
                        <p class="font-bold text-gray-800 truncate">${GLOBAL_CHAT_ROOM_NAME}</p>
                    </div>
                    <div class="flex justify-between items-center mt-1">
                        <p class="text-sm text-gray-500 truncate">گفتگوی عمومی آریانا</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('global-chat-item').addEventListener('click', () => {
        showMainView('chat');
    });
};


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
    // ... (function is unchanged)
};

const loadOlderMessages = async () => {
  // ... (function is unchanged)
};

messagesContainer.addEventListener('scroll', () => {
  if (messagesContainer.scrollTop < 50) { loadOlderMessages(); }
  const isScrolledUp = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight > 200;
  scrollToBottomBtn.classList.remove('view-hidden');
  scrollToBottomBtn.classList.toggle('opacity-0', !isScrolledUp);
});
scrollToBottomBtn.addEventListener('click', () => { scrollToBottom('smooth'); });

const renderMessages = async (messages, prepend = false, isInitialLoad = false) => {
  // ... (function is unchanged)
};

// --- Avatar Click Logic ---
const showUserAvatar = (name, url) => {
    viewAvatarName.textContent = name || 'کاربر';
    viewAvatarDisplay.innerHTML = generateAvatar(name, url);
    showModal('view-avatar-modal');
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
        showModal('change-user-avatar-in-chat-modal');
    } else {
        showUserAvatar(authorName, authorAvatarUrl);
    }
});

closeViewAvatarModalBtn.addEventListener('click', () => hideAllModals());
document.querySelector('#change-user-avatar-in-chat-modal .cancel-btn').addEventListener('click', () => hideAllModals());

userAvatarInChatInput.addEventListener('change', async (e) => {
    // ... (function is unchanged)
});

changeUserAvatarInChatForm.addEventListener('submit', async (e) => {
    // ... (rest of the function is unchanged, but uses hideAllModals())
});

// --- File Handling & Image Compression ---
const compressImage = (file, maxDimension) => {
    // ... (function is unchanged)
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
        filePreviewContainer.innerHTML = `<div class="text-center text-gray-700"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-16 h-16 mx-auto text-gray-500"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg><p class="font-semibold mt-2 break-all">${file.name}</p></div>`;
    }
    showModal('file-confirm-modal');
};

const uploadConfirmedFile = async () => {
    // ... (rest of the function is unchanged, but uses hideAllModals())
};

fileInput.addEventListener('change', handleFileSelect);
cancelFileUploadBtn.addEventListener('click', () => { fileToUpload = null; hideAllModals(); });
confirmFileUploadBtn.addEventListener('click', uploadConfirmedFile);

// --- Event Listeners & App Flow ---
initialUserAvatarInput.addEventListener('change', (e) => {
    // ... (function is unchanged)
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
    // ... (function is unchanged)
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
    // ... (function is unchanged)
};

const findAndJoinEmptySlot = async () => {
    const slotsRef = collection(db, 'videoRooms', VIDEO_CALL_ROOM_ID, 'slots');
    const slotsSnapshot = await getDocs(slotsRef);
    const occupiedSlots = new Set(slotsSnapshot.docs.map(d => parseInt(d.id.split('_')[1])));
    
    let targetSlotId = -1;
    const hasMedia = !!localStream;

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
      showMainView('home');
    }
};

const enterVideoCallRoom = async () => {
    // ... (function is unchanged)
};

const initializeVideoUI = () => {
  // ... (function is unchanged)
};

const joinVideoSlot = async (slotId) => {
    // ... (function is unchanged)
};

const startPeerConnection = async (remoteUserId) => {
    // ... (function is unchanged)
}

const createPeerConnection = (remoteUserId) => {
    // ... (function is unchanged)
};


const setupVideoCallListeners = () => {
    // ... (function is unchanged)
};

const hangUp = async (fullCleanup = true) => {
    // ... (function is unchanged)
};

const cleanUpVideoCall = async () => {
    // ... (function is unchanged)
};

toggleMicBtn.addEventListener('click', () => {
    // ... (function is unchanged)
});

toggleCameraBtn.addEventListener('click', async () => {
    // ... (function is unchanged)
});


// --- App Entry Point ---
const ensureVideoCallRoomExists = async () => {
  // ... (function is unchanged)
};

const ensureGlobalChatRoomExists = async () => {
  // ... (function is unchanged)
};

const clearMyPreviousSlotOnStartup = async () => {
    // ... (function is unchanged)
};

const listenForGlobalSettings = () => {
    const globalSettingsRef = doc(db, 'app_settings', 'global');
    onSnapshot(globalSettingsRef, (docSnap) => {
        let newBackground = null;
        if (docSnap.exists()) {
            newBackground = docSnap.data().backgroundUrl;
        }
        if (newBackground !== currentStaticBackground) {
            currentStaticBackground = newBackground;
            applyBackgroundSettings(currentStaticBackground);
            localStorage.setItem(STATIC_BACKGROUND_KEY, currentStaticBackground || '');
        }
    });
};

const startApp = async () => {
  const appAccessGranted = localStorage.getItem(APP_ACCESS_KEY);

  if (!appAccessGranted) {
    usernameModal.classList.remove('view-hidden');
    mainContentWrapper.parentElement.classList.add('view-hidden');
    usernameInput.focus();
    return;
  }
  mainContentWrapper.parentElement.classList.remove('view-hidden');

  // Load and apply settings
  const storedFontSize = localStorage.getItem(FONT_SIZE_KEY) || 'md';
  const storedGlassMode = localStorage.getItem(GLASS_MODE_KEY) || 'off';
  currentSendWithEnter = localStorage.getItem(SEND_WITH_ENTER_KEY) || 'on';
  applyFontSize(storedFontSize);
  applyGlassModeSelection(storedGlassMode);
  applySendWithEnterSelection(currentSendWithEnter);

  currentStaticBackground = localStorage.getItem(STATIC_BACKGROUND_KEY);
  applyBackgroundSettings(currentStaticBackground);
  listenForGlobalSettings();
  
  try {
    await ensureVideoCallRoomExists();
    await ensureGlobalChatRoomExists();
  } catch(e) {
    console.error("Fatal error during startup (ensure rooms exist):", e);
    document.body.innerHTML = '<h1>خطای راه اندازی برنامه</h1><p>لطفا صفحه را رفرش کنید.</p>';
    return;
  }

  try {
    const userDoc = await getDoc(doc(db, 'users', currentUserId));
    if (userDoc.exists()) {
        const userData = userDoc.data();
        currentUsername = userData.username || localStorage.getItem(USERNAME_KEY);
        currentUserAvatar = userData.avatarUrl || localStorage.getItem(USER_AVATAR_KEY) || null;
        userProfilesCache[currentUserId] = { username: currentUsername, avatarUrl: currentUserAvatar };
        localStorage.setItem(USERNAME_KEY, currentUsername);
        localStorage.setItem(USER_AVATAR_KEY, currentUserAvatar || '');
    } else {
        currentUsername = localStorage.getItem(USERNAME_KEY);
        currentUserAvatar = localStorage.getItem(USER_AVATAR_KEY) || null;
    }
  } catch (error) {
    console.error("Error fetching user profile, using local data:", error);
    currentUsername = localStorage.getItem(USERNAME_KEY);
    currentUserAvatar = localStorage.getItem(USER_AVATAR_KEY) || null;
  }
  
  await clearMyPreviousSlotOnStartup();
  
  // Setup nav listeners
  navChatsBtn.addEventListener('click', () => showMainView('home'));
  navStudioBtn.addEventListener('click', () => showMainView('studio'));
  navSettingsBtn.addEventListener('click', () => {
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

      showModal('settings-modal');
  });
  backToHomeBtn.addEventListener('click', () => showMainView('home'));
  backToHomeFromVideoBtn.addEventListener('click', () => showMainView('home'));
  
  hideAllModals();
  updateSendButtonState();
  showMainView('home');
};

startApp();
