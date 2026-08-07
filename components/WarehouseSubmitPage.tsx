import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseClient';
import { doc, getDoc, updateDoc, collection, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { 
    ClipboardList, CheckCircle, CheckCircle2, AlertCircle, Search, Save, Package, 
    Lock, ArrowLeft, Info, HelpCircle, Loader2, RefreshCw, User, FileText, 
    ChevronRight, PenTool, RotateCcw, Sparkles, Filter, AlertTriangle,
    Camera, Mic, Zap, Target, Volume2, VolumeX, MapPin, XCircle, Trash2,
    Fingerprint, X, ChevronLeft, BarChart3, Clock, TrendingDown, TrendingUp, Check, ThumbsUp, Activity, FileCheck2, Wallet, Boxes, Calendar, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { audioSynth } from '../utils/audioSynth';
import confetti from 'canvas-confetti';
import { Html5Qrcode } from 'html5-qrcode';
import { SharedAudit, SharedAuditItem } from '../types';

// Import newly modularized audit subcomponents
import SharedAuditHome from './audit/SharedAuditHome';
import SharedCountingExperience from './audit/SharedCountingExperience';
import SharedSupervisorFeatures from './audit/SharedSupervisorFeatures';
import SharedNotificationCenter from './audit/SharedNotificationCenter';
import SharedAuditReports from './audit/SharedAuditReports';
import { useLiveCollaboration } from '../src/hooks/useLiveCollaboration';

export default function WarehouseSubmitPage() {
    const { auditId } = useParams<{ auditId: string }>();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [audit, setAudit] = useState<SharedAudit | null>(null);
    
    // Passcode lock screen state
    const [passcode, setPasscode] = useState('');
    const [passcodeError, setPasscodeError] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isIdentified, setIsIdentified] = useState(false);
    const [isBiometricSupported, setIsBiometricSupported] = useState(false);
    const [managerSignature, setManagerSignature] = useState<string | null>(null);
    const [showTutorial, setShowTutorial] = useState(false);
    const [tutorialStep, setTutorialStep] = useState(0);

    // Form inputs state
    const [managerName, setManagerName] = useState('');
    const [managerNotes, setManagerNotes] = useState('');
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
    const [itemPhotos, setItemPhotos] = useState<Record<string, string>>({});
    const [savedToastKey, setSavedToastKey] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterMode, setFilterMode] = useState<'all' | 'discrepancy' | 'uncounted'>('all');
    const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);
    
    // New tabbed interface states for comprehensive warehouse audit upgrades
    const [activeTab, setActiveTab] = useState<'worksheet' | 'dashboard' | 'notifications' | 'sessions' | 'reports'>('dashboard');
    const [liveLogs, setLiveLogs] = useState<{ id: string; text: string; time: string; type: 'scan' | 'save' | 'system' | 'warn' }[]>([]);

    // Shared collaboration state
    const collaboration = useLiveCollaboration(auditId || '', managerName || 'Responsible');
    
    // Sync local audit state with collaboration audit data
    useEffect(() => {
        if (collaboration.auditData) {
            setAudit(collaboration.auditData);
        }
    }, [collaboration.auditData]);

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault();
            const nextInput = document.getElementById(`count-input-${index + 1}`);
            if (nextInput) {
                (nextInput as HTMLInputElement).focus();
                (nextInput as HTMLInputElement).select();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevInput = document.getElementById(`count-input-${index - 1}`);
            if (prevInput) {
                (prevInput as HTMLInputElement).focus();
                (prevInput as HTMLInputElement).select();
            }
        }
    };

    const handleConfirmItem = async (key: string, val: number) => {
        let newCounts = { ...counts };
        if (key !== 'draft_save_dummy') {
            newCounts[key] = val;
        }
        setCounts(newCounts);
        
        // Log action in the live activity log - skip for dummy draft saves
        if (key !== 'draft_save_dummy') {
            const itemObj = audit?.items?.find(it => (it.variantId ? `${it.productId}_${it.variantId}` : it.productId) === key);
            const itemName = itemObj ? itemObj.name : 'صنف جرد';
            setLiveLogs(prev => [
                {
                    id: 'log-' + Math.random().toString(36).substring(7),
                    text: `تم تأكيد عد [${itemName}] بكمية ${val} قطعة في قطاع [${activeZone || 'الرف العام'}]`,
                    time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    type: 'save' as const
                },
                ...prev
            ]);
        }
        
        try {
            localStorage.setItem(`audit_draft_counts_${auditId}`, JSON.stringify(newCounts));
            if (Object.keys(itemNotes).length > 0) {
                localStorage.setItem(`audit_draft_notes_${auditId}`, JSON.stringify(itemNotes));
            }
        } catch (e) {
            console.warn("LocalStorage draft save error:", e);
        }

        audioSynth.playTone('success');
        triggerHaptic();

        setSavedToastKey(key);
        setTimeout(() => setSavedToastKey(null), 2500);

        if (auditId) {
            try {
                const docRef = doc(db, 'shared_audits', auditId);
                await updateDoc(docRef, {
                    draftCounts: newCounts,
                    draftNotes: itemNotes,
                    lastSavedAt: serverTimestamp()
                });
            } catch (err) {
                console.warn('Firestore draft update error:', err);
            }
        }
    };

    // Voice Input State
    const [isListening, setIsListening] = useState(false);
    const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);

    // Toggle showing system/book quantities (blind count toggle)
    const [showSystemQty, setShowSystemQty] = useState(false);

    // Scanning & Focus Mode State
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [fullImageView, setFullImageView] = useState<string | null>(null);
    const [scannerError, setScannerError] = useState<string | null>(null);
    const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [deviceId, setDeviceId] = useState('');
    const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
    const [activeZone, setActiveZone] = useState('');
    const [recentScans, setRecentScans] = useState<{name: string, time: string}[]>([]);
    const [milestonesReached, setMilestonesReached] = useState<number[]>([]);

    // Voice Synthesis with Egyptian Phrasing
    const speak = (text: string) => {
        if (!isVoiceEnabled) return;
        audioSynth.speak(text);
    };

    const playBeepSound = () => audioSynth.playTone('click');
    const playChangeSound = () => audioSynth.playTone('info');
    const playSuccessSound = () => audioSynth.playTone('success');

    // Signature Canvas State
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSigned, setHasSigned] = useState(false);

    // Derived State
    const filteredItems = useMemo(() => {
        if (!audit || !audit.items) return [];
        return audit.items.filter(item => {
            if (!item) return false;
            const name = item.name || '';
            const sku = item.sku || '';
            const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                  sku.toLowerCase().includes(searchQuery.toLowerCase());
            if (!matchesSearch) return false;

            if (filterMode === 'discrepancy') {
                const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
                const actual = counts[key] ?? item.systemQty;
                return actual !== item.systemQty;
            }
            if (filterMode === 'uncounted') {
                const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
                return counts[key] === undefined || counts[key] === null;
            }
            return true;
        });
    }, [audit, searchQuery, filterMode, counts, showSystemQty]);

    const countedCount = useMemo(() => {
        if (!audit || !audit.items) return 0;
        return audit.items.filter(item => {
            if (!item) return false;
            const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
            return counts[key] !== undefined && counts[key] !== null;
        }).length;
    }, [audit, counts]);

    const progressPercentage = useMemo(() => {
        if (!audit || !audit.items || audit.items.length === 0) return 0;
        return Math.round((countedCount / audit.items.length) * 100);
    }, [audit, countedCount]);

    // Milestones tracking
    useEffect(() => {
        if (!isUnlocked || !audit) return;
        const progress = progressPercentage;
        const milestones = [25, 50, 75, 100];
        milestones.forEach(m => {
            if (progress >= m && !milestonesReached.includes(m)) {
                setMilestonesReached(prev => [...prev, m]);
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#4f46e5', '#10b981', '#f59e0b']
                });
                
                // Egyptian phrasing
                if (m === 25) speak('عاش يا بطل، خلصت ربع الجرد');
                else if (m === 50) speak('جميل جداً، وصلنا نص المشوار');
                else if (m === 75) speak('قربنا نخلص، فاضل تكة');
                else if (m === 100) speak('مبروك يا وحش! الجرد كمل مية في المية');
            }
        });
    }, [progressPercentage, isUnlocked, audit, milestonesReached]);

    const triggerHaptic = () => {
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            try { navigator.vibrate(50); } catch (e) {}
        }
    };

    // Voice Input Handler (Speech to Text)
    const handleVoiceInput = (targetField: 'search' | string) => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            customAlert('غير مدعوم', 'عذراً، متصفحك لا يدعم خاصية التعرف على الصوت.', 'warning');
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.lang = 'ar-SA';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsListening(true);
            setActiveVoiceField(targetField);
            audioSynth.playTone('click');
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            if (targetField === 'search') {
                setSearchQuery(transcript);
            } else {
                setItemNotes(prev => ({
                    ...prev,
                    [targetField]: (prev[targetField] || '') + ' ' + transcript
                }));
            }
            audioSynth.playTone('success');
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
            setActiveVoiceField(null);
        };

        recognition.onend = () => {
            setIsListening(false);
            setActiveVoiceField(null);
        };

        recognition.start();
    };

    // Photo Capture Handler
    const handlePhotoCapture = (key: string, file: File | null) => {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            setItemPhotos(prev => ({
                ...prev,
                [key]: base64
            }));
            audioSynth.playTone('success');
            customAlert('تم التقاط الصورة', 'تم إرفاق صورة للمنتج بنجاح.', 'success');
        };
        reader.readAsDataURL(file);
    };

    // Scanner logic
    const handleBarcodeScanned = (decodedText: string) => {
        if (!audit) return;
        const cleanedText = decodedText.trim();
        
        // Find matching item in audit list
        const match = audit.items.find(item => 
            item.sku === cleanedText || 
            item.productId === cleanedText ||
            item.name.includes(cleanedText)
        );

        if (match) {
            const key = match.variantId ? `${match.productId}_${match.variantId}` : match.productId;
            setCounts(prev => ({
                ...prev,
                [key]: (prev[key] || 0) + 1
            }));
            
            triggerHaptic();
            playBeepSound();
            speak(match.name);
            
            setRecentScans(prev => [
                { name: match.name, time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) },
                ...prev
            ].slice(0, 5));

            setLiveLogs(prev => [
                {
                    id: 'log-' + Math.random().toString(36).substring(7),
                    text: `مسح باركود ناجح: [${match.name}] في قطاع [${activeZone || 'الرف العام'}] (+1 قطع)`,
                    time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    type: 'scan' as const
                },
                ...prev
            ]);
        } else {
            audioSynth.playTone('error');
            triggerHaptic();
            speak('الصنف ده مش موجود في كشف الجرد');

            setLiveLogs(prev => [
                {
                    id: 'log-' + Math.random().toString(36).substring(7),
                    text: `⚠️ محاولة مسح باركود غير معرف: [${cleanedText}]`,
                    time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    type: 'warn' as const
                },
                ...prev
            ]);
        }
    };

    useEffect(() => {
        let scanner: Html5Qrcode | null = null;
        if (isScannerOpen) {
            scanner = new Html5Qrcode("reader");
            scanner.start(
                { facingMode: { exact: "environment" } },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText) => {
                    handleBarcodeScanned(decodedText);
                },
                () => {}
            ).catch(() => {
                // Fallback to any available camera if "environment" fails
                return scanner?.start(
                    { facingMode: "user" },
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    (decodedText) => {
                        handleBarcodeScanned(decodedText);
                    },
                    () => {}
                );
            }).catch(err => {
                setScannerError("مش عارفين نفتح الكاميرا، اتأكد من صلاحيات الكاميرا أو جرب متصفح تاني.");
                console.error("Camera access or init failed:", err);
            });
        }
        return () => {
            if (scanner) {
                scanner.stop().catch(e => console.error(e));
            }
        };
    }, [isScannerOpen]);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            speak("الإنترنت متصل الآن، سيتم مزامنة أي فوارق معلقة تلقائياً");
            setLiveLogs(prev => [
                {
                    id: 'log-' + Math.random().toString(36).substring(7),
                    text: `📡 تم استعادة الاتصال بالإنترنت بنجاح. جاري المزامنة السحابية...`,
                    time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    type: 'system'
                },
                ...prev
            ]);
        };
        const handleOffline = () => {
            setIsOnline(false);
            speak("تم فقدان الاتصال بالإنترنت، نظام طابور الحفظ المحلي مفعل الآن");
            setLiveLogs(prev => [
                {
                    id: 'log-' + Math.random().toString(36).substring(7),
                    text: `🚨 انقطع الاتصال بالإنترنت! تم تفعيل طابور الحفظ المحلي غير المتصل.`,
                    time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    type: 'warn'
                },
                ...prev
            ]);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Custom UI Dialog States
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void | Promise<void>;
        type?: 'info' | 'warning' | 'danger' | 'success';
    } | null>(null);

    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type?: 'info' | 'warning' | 'danger' | 'success';
    } | null>(null);

    const customConfirm = (title: string, message: string, onConfirm: () => void | Promise<void>, type: 'info' | 'warning' | 'danger' | 'success' = 'warning') => {
        setConfirmDialog({
            isOpen: true,
            title,
            message,
            onConfirm,
            type
        });
    };

    const customAlert = (title: string, message: string, type: 'info' | 'warning' | 'danger' | 'success' = 'info') => {
        setAlertDialog({
            isOpen: true,
            title,
            message,
            type
        });
    };

    // Drawing Canvas Handlers
    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        ctx.beginPath();
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
        setIsDrawing(true);
        setHasSigned(true);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSigned(false);
        audioSynth.playTone('click');
    };

    // Load the audit document from Firestore
    const fetchAudit = async () => {
        if (!auditId) {
            setError('رابط الجرد غير صالح');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const docRef = doc(db, 'shared_audits', auditId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data() as SharedAudit;
                setAudit(data);
                
                // Initialize form values from loaded data (preserve saved local identity if Firestore data is empty)
                const savedLocalName = (auditId && localStorage.getItem(`audit_manager_name_${auditId}`)) || localStorage.getItem('audit_manager_name') || '';
                const nameToUse = data.managerName || savedLocalName;
                if (nameToUse) {
                    setManagerName(nameToUse);
                }
                setManagerNotes(data.notes || '');
                
                const initialCounts: Record<string, number> = {};
                const initialNotes: Record<string, string> = {};
                
                data.items.forEach((item) => {
                    const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
                    if (item.actualQty !== undefined && item.actualQty !== null) {
                        initialCounts[key] = item.actualQty;
                    }
                    initialNotes[key] = item.notes || '';
                });
                
                // Retrieve local draft counts & notes from localStorage
                let localCounts: Record<string, number> = {};
                try {
                    const savedCountsStr = localStorage.getItem(`audit_draft_counts_${auditId}`);
                    if (savedCountsStr) localCounts = JSON.parse(savedCountsStr);
                } catch(e) {}

                let localNotes: Record<string, string> = {};
                try {
                    const savedNotesStr = localStorage.getItem(`audit_draft_notes_${auditId}`);
                    if (savedNotesStr) localNotes = JSON.parse(savedNotesStr);
                } catch(e) {}

                // Retrieve cloud draft counts & notes from Firestore
                const firestoreDraftCounts = (data as any).draftCounts || {};
                const firestoreDraftNotes = (data as any).draftNotes || {};

                // Merge all sources: local drafts > cloud drafts > initial submitted counts
                const mergedCounts = { ...initialCounts, ...firestoreDraftCounts, ...localCounts };
                const mergedNotes = { ...initialNotes, ...firestoreDraftNotes, ...localNotes };

                setCounts(mergedCounts);
                setItemNotes(mergedNotes);

                if (Object.keys(mergedCounts).length > 0) {
                    localStorage.setItem(`audit_draft_counts_${auditId}`, JSON.stringify(mergedCounts));
                }

                // Initialize photos if any (though usually empty for new audits)
                const initialPhotos: Record<string, string> = {};
                data.items.forEach(item => {
                    const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
                    if ((item as any).proofImage) initialPhotos[key] = (item as any).proofImage;
                });
                setItemPhotos(initialPhotos);

                // Handle Blind Count Mode
                if (data.isBlindCount) {
                    setShowSystemQty(false);
                }

                // If already submitted or approved, mark as identified
                if (data.status !== 'pending' && data.status !== 'rejected') {
                    setIsIdentified(true);
                }

                // If passcode is not set, unlock immediately
                if (!data.passcode) {
                    setIsUnlocked(true);
                }
            } else {
                setError('عذراً، لم يتم العثور على جلسة الجرد المطلوبة. قد تكون قد حُذفت أو انتهت صلاحيتها.');
            }
        } catch (err: any) {
            console.error('Error fetching audit:', err);
            setError('حدث خطأ أثناء تحميل بيانات الجرد. يرجى التحقق من اتصال الإنترنت والمحاولة مجدداً.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAudit();
        
        // Initialize Device ID
        let id = localStorage.getItem('audit_device_id');
        if (!id) {
            id = 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('audit_device_id', id);
        }
        setDeviceId(id);

        // Load persisted identity & unlocked session
        const savedName = (auditId && localStorage.getItem(`audit_manager_name_${auditId}`)) || localStorage.getItem('audit_manager_name');
        const savedSig = (auditId && localStorage.getItem(`audit_manager_signature_${auditId}`)) || localStorage.getItem('audit_manager_signature');
        const savedUnlocked = localStorage.getItem(`audit_unlocked_${auditId}`);
        if (savedName) setManagerName(savedName);
        if (savedSig) {
            setManagerSignature(savedSig);
            setHasSigned(true);
        }
        if (savedUnlocked === 'true' && savedName && savedSig) {
            setIsUnlocked(true);
            setIsIdentified(true);
        }

        // Get Location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (err) => console.warn('Location access denied', err)
            );
        }

        // Check for biometric support
        if (window.PublicKeyCredential && 
            window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
            window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(result => {
                setIsBiometricSupported(result);
            });
        }

        // Check if user has disabled tutorial permanently or seen it
        const tutorialDisabled = localStorage.getItem('tutorial_disabled_permanently');
        const hasSeen = localStorage.getItem(`tutorial_seen_${auditId}`);
        if (!tutorialDisabled && !hasSeen) {
            setShowTutorial(true);
        }
    }, [auditId]);

    // Initialize live logs once unlocked and loaded
    useEffect(() => {
        if (isUnlocked && audit && liveLogs.length === 0) {
            const initialLogs: { id: string; text: string; time: string; type: 'scan' | 'save' | 'system' | 'warn' }[] = [
                {
                    id: 'init-1',
                    text: `📡 تم الاتصال الآمن بالمستودع الموحد: ${audit.warehouseName || 'المخزن الرئيسي'}`,
                    time: new Date(Date.now() - 60000).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
                    type: 'system' as const
                },
                {
                    id: 'init-2',
                    text: `👥 انضمام المسؤول الميداني [${managerName || 'مسؤول مخزن'}] للجلسة المفتوحة.`,
                    time: new Date(Date.now() - 40000).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
                    type: 'system' as const
                },
                {
                    id: 'init-3',
                    text: `✅ جاري تتبع الفروقات الميدانية ومزامنة التغييرات تلقائياً مع التاجر الإداري.`,
                    time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
                    type: 'system' as const
                }
            ];
            
            if (audit.status === 'rejected') {
                initialLogs.unshift({
                    id: 'init-warn',
                    text: `⚠️ تنبيه جرد: تم إعادة فتح ورقة الجرد الميداني بعد الرفض والتعليق من قبل التاجر.`,
                    time: new Date(Date.now() - 30000).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
                    type: 'warn' as const
                });
            }
            setLiveLogs(initialLogs);
        }
    }, [isUnlocked, audit, managerName, liveLogs.length]);

    // Auto-advance tutorial based on real actions
    useEffect(() => {
        if (!showTutorial) return;

        if (tutorialStep === 4 && isUnlocked) {
             setTutorialStep(5);
             speak("ممتاز! تم فتح الجلسة بنجاح. هذه لوحة نتائج الجرد المباشرة لمتابعة المجرود والمتبقي.");
        } else if (tutorialStep === 5 && (isScannerOpen || searchQuery.length > 0 || filterMode === 'uncounted')) {
             setTutorialStep(6);
             speak("تقدر تمسح باركود الصنف بالكاميرا أو تبحث عنه بسهولة هنا");
        } else if (tutorialStep === 6 && countedCount > 0) {
             setTutorialStep(7);
             speak("سجل العدد الفعلي للصنف على الرف ودوس علامة الصح الخضراء");
        } else if (tutorialStep === 7 && countedCount === (audit?.items?.length || 0)) {
             setTutorialStep(8);
             speak("أخر خطوة، لما تخلص كل الأصناف دوس على زرار تسليم الجرد نهائياً");
        }
    }, [isUnlocked, tutorialStep, showTutorial, auditId, isScannerOpen, searchQuery, filterMode, countedCount, audit?.items?.length]);

    const handleBiometricAuth = async () => {
        try {
            // Check if biometric is supported
            if (!isBiometricSupported) {
                customAlert('غير مدعوم', 'عذراً، جهازك لا يدعم المصادقة الحيوية أو لم يتم تفعيلها.', 'warning');
                return;
            }

            // Simple WebAuthn assertion to "verify" the user on their device
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);

            const options: any = {
                publicKey: {
                    challenge,
                    timeout: 60000,
                    userVerification: 'required',
                    rpId: window.location.hostname,
                    allowCredentials: [], 
                    authenticatorSelection: {
                        userVerification: 'required',
                        platformAuthenticatorCompatible: true
                    }
                }
            };

            await (navigator.credentials as any).create(options);
            
            audioSynth.playTone('success');
            setIsUnlocked(true);
            setIsIdentified(true); // Auto-identify if they used biometrics to login
            customAlert('تم التحقق', 'تم الدخول وتوثيق هويتك بنجاح عبر البصمة الحيوية.', 'success');
        } catch (err: any) {
            console.error('Biometric Auth Error:', err);
            if (err.name !== 'NotAllowedError') {
                customAlert('فشل التحقق', 'فشلت عملية المصادقة الحيوية. يرجى المحاولة مرة أخرى أو استخدام كلمة المرور.', 'danger');
            }
        }
    };

    const handleBiometricVerifyIdentity = async () => {
        try {
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);

            const options: any = {
                publicKey: {
                    challenge,
                    timeout: 60000,
                    userVerification: 'required',
                    rpId: window.location.hostname,
                    allowCredentials: [], 
                    authenticatorSelection: {
                        userVerification: 'required',
                        platformAuthenticatorCompatible: true
                    }
                }
            };

            await (navigator.credentials as any).create(options);
            
            audioSynth.playTone('success');
            customAlert('تم التوثيق', 'تم توثيق هويتك عبر النظام الحيوي للجهاز بنجاح.', 'success');
            return true;
        } catch (err: any) {
            console.error('Biometric Identity Error:', err);
            // Don't alert on cancel, just return false
            if (err.name !== 'NotAllowedError') {
                customAlert('فشل التوثيق', 'تعذر استخدام البصمة في الوقت الحالي، يمكنك المتابعة يدوياً.', 'warning');
            }
            return false;
        }
    };

    // Handle unlocking via passcode, name, and signature together
    const handleUnlock = (e: React.FormEvent) => {
        e.preventDefault();
        if (!audit) return;

        // 1. Passcode check
        if (audit.passcode && passcode !== audit.passcode) {
            setPasscodeError(true);
            audioSynth.playTone('error');
            customAlert('رمز المرور خاطئ', 'رمز المرور غير صحيح، يرجى التأكد من الرمز المكون من 4 أرقام المرسل إليك من التاجر.', 'danger');
            return;
        }

        // 2. Manager Name check
        if (!managerName.trim()) {
            audioSynth.playTone('warning');
            customAlert('اسم المسؤول إجباري', 'يرجى كتابة اسم مسؤول المخزن بالكامل قبل فتح الجلسة.', 'warning');
            return;
        }

        // 3. Signature check
        let signatureBase64 = managerSignature;
        if (!signatureBase64 && canvasRef.current && hasSigned) {
            signatureBase64 = canvasRef.current.toDataURL('image/png');
            setManagerSignature(signatureBase64);
        }

        if (!signatureBase64 && !hasSigned) {
            audioSynth.playTone('warning');
            customAlert('التوقيع إجباري', 'يرجى وضع توقيعك الرقمي في المربع المخصص قبل فتح الجلسة.', 'warning');
            return;
        }

        setIsUnlocked(true);
        setIsIdentified(true);
        setPasscodeError(false);
        audioSynth.playTone('success');

        if (auditId) {
            localStorage.setItem(`audit_unlocked_${auditId}`, 'true');
            localStorage.setItem('audit_manager_name', managerName.trim());
            if (signatureBase64) localStorage.setItem('audit_manager_signature', signatureBase64);
        }

        speak('تم فتح الجلسة بنجاح، يمكنك الآن البدء في جرد وحصر الأصناف.');
        if (showTutorial && tutorialStep < 5) {
            setTutorialStep(5);
        }
    };

    // Removed redundant session tracking logic as it is now handled by SharedCountingExperience subcomponent

    // Save identity changes
    useEffect(() => {
        if (managerName) {
            localStorage.setItem('audit_manager_name', managerName);
            if (auditId) localStorage.setItem(`audit_manager_name_${auditId}`, managerName);
        }
    }, [managerName, auditId]);

    useEffect(() => {
        if (managerSignature) {
            localStorage.setItem('audit_manager_signature', managerSignature);
            if (auditId) localStorage.setItem(`audit_manager_signature_${auditId}`, managerSignature);
        }
    }, [managerSignature, auditId]);

    // Persistence: Save/Load session data from localStorage
    useEffect(() => {
        if (!auditId) return;
        try {
            const savedCounts = localStorage.getItem(`audit_draft_counts_${auditId}`);
            if (savedCounts) setCounts(JSON.parse(savedCounts));

            const savedNotes = localStorage.getItem(`audit_draft_notes_${auditId}`);
            if (savedNotes) setItemNotes(JSON.parse(savedNotes));

            const savedPhotos = localStorage.getItem(`audit_draft_photos_${auditId}`);
            if (savedPhotos) setItemPhotos(JSON.parse(savedPhotos));
        } catch (e) {
            console.warn("LocalStorage access failed: ", e);
        }
    }, [auditId]);

    // Persistence: Save session data on change
    useEffect(() => {
        if (!auditId) return;
        if (Object.keys(counts).length > 0) localStorage.setItem(`audit_draft_counts_${auditId}`, JSON.stringify(counts));
    }, [counts, auditId]);

    useEffect(() => {
        if (!auditId) return;
        if (Object.keys(itemNotes).length > 0) localStorage.setItem(`audit_draft_notes_${auditId}`, JSON.stringify(itemNotes));
    }, [itemNotes, auditId]);

    useEffect(() => {
        if (!auditId) return;
        if (Object.keys(itemPhotos).length > 0) localStorage.setItem(`audit_draft_photos_${auditId}`, JSON.stringify(itemPhotos));
    }, [itemPhotos, auditId]);

    const handleActualSubmit = async () => {
        try {
            setLoading(true);
            const docRef = doc(db, 'shared_audits', auditId!);

            // Map inputs back to items array
            const updatedItems = audit!.items.map(item => {
                const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
                return {
                    ...item,
                    actualQty: counts[key] !== undefined ? Number(counts[key]) : 0,
                    notes: itemNotes[key] || '',
                    proofImage: itemPhotos[key] || ''
                };
            });

            let signatureBase64 = audit?.signatureData || '';
            if (managerSignature) {
                signatureBase64 = managerSignature;
            } else if (canvasRef.current && hasSigned) {
                signatureBase64 = canvasRef.current.toDataURL('image/png');
            }

            const updates = {
                status: 'submitted',
                managerName: managerName.trim(),
                notes: managerNotes.trim(), // Ensure we use the correct notes state
                signatureData: signatureBase64,
                items: updatedItems,
                submittedAt: new Date().toISOString()
            };

            await updateDoc(docRef, updates);
            
            // Update local state to reflect submission
            setAudit(prev => prev ? { ...prev, ...updates as any } : null);
            audioSynth.announce("مبروك، الجرد اتسلم للتاجر بنجاح وكله تمام، جاري المراجعة.", "success");
            customAlert('تم التسليم بنجاح', 'تم تسليم الجرد بنجاح للتاجر لمراجعته واعتماده المالي!', 'success');
        } catch (err: any) {
            console.error('Error submitting audit:', err);
            customAlert('خطأ', 'حدث خطأ أثناء تسليم الجرد. يرجى المحاولة مرة أخرى.', 'danger');
        } finally {
            setLoading(false);
        }
    };

    // Handle submitting counted quantities back to Firestore
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!auditId || !audit) return;

        if (!managerName.trim()) {
            customAlert('تنبيه', 'يرجى إدخال اسم مسؤول المخزن القائم بالجرد لتسليم الجلسة', 'warning');
            return;
        }

        if (!hasSigned && !audit.signatureData) {
            customAlert('تنبيه والتوقيع', 'يرجى الإمضاء والتوقيع الرقمي في مربع التوقيع قبل تسليم الجلسة للتاجر.', 'warning');
            return;
        }

        const uncountedCount = audit.items.filter(item => {
            const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
            return counts[key] === undefined;
        }).length;

        if (uncountedCount > 0) {
            customConfirm(
                'أصناف لم تجرد بعد',
                `هناك ${uncountedCount} صنف لم يتم تسجيل كمياتهم. هل تريد المتابعة وتسليم الجرد ناقصاً؟`,
                () => {
                    customConfirm(
                        'تسليم كميات الجرد وتأكيد الإمضاء',
                        'هل أنت متأكد من تسليم كميات الجرد والتوقيع الحالي للتاجر؟ لن تتمكن من التعديل إلا في حال طلب التاجر إعادة العد.',
                        handleActualSubmit,
                        'warning'
                    );
                },
                'danger'
            );
            return;
        }

        customConfirm(
            'تسليم كميات الجرد وتأكيد الإمضاء',
            'هل أنت متأكد من تسليم كميات الجرد والتوقيع الحالي للتاجر؟ لن تتمكن من التعديل إلا في حال طلب التاجر إعادة العد.',
            handleActualSubmit,
            'warning'
        );
    };

    const handleUpdateAuditStatus = async (newStatus: 'pending' | 'submitted' | 'approved' | 'rejected') => {
        try {
            setLoading(true);
            const docRef = doc(db, 'shared_audits', auditId!);
            await updateDoc(docRef, { status: newStatus });
            setAudit(prev => prev ? { ...prev, status: newStatus } : null);
            customAlert('تم تحديث الحالة', `تم تحديث حالة الجرد بنجاح إلى: ${newStatus === 'approved' ? 'معتمد' : newStatus === 'rejected' ? 'مرفوض/إعادة عد' : 'قيد الانتظار'}`, 'success');
        } catch (err: any) {
            console.error('Error updating status:', err);
            customAlert('خطأ', 'حدث خطأ أثناء تحديث حالة الجرد', 'danger');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 dir-rtl">
                <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mb-4" />
                <p className="text-slate-600 dark:text-slate-400 font-bold text-sm">جاري تحميل بيانات جلسة الجرد...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 dir-rtl text-right" dir="rtl">
                <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-950/50 rounded-[2.5rem] p-8 shadow-2xl max-w-md text-center space-y-6 animate-in zoom-in-95 duration-300">
                    <div className="mx-auto w-20 h-20 bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-3xl flex items-center justify-center shadow-inner">
                        <AlertTriangle size={40} />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-slate-800 dark:text-white">عذراً، فيه مشكلة</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-bold">{error}</p>
                    </div>
                    <button 
                        onClick={() => navigate('/')} 
                        className="w-full py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-sm font-black transition-all active:scale-[0.98]"
                    >
                        الرجوع للرئيسية
                    </button>
                </div>
            </div>
        );
    }

    // Passcode Lock & Identification Unified Screen View
    if (!isUnlocked && audit) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 dir-rtl">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl max-w-lg w-full text-right space-y-6 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                        <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
                            <Lock size={28} />
                        </div>
                        <div className="space-y-1 flex-1">
                            <h2 className="text-xl font-black text-slate-800 dark:text-white">دخول وتوثيق جلسة الجرد</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">أدخل كلمة السر واسمك وتوقيعك للبدء مباشرة</p>
                        </div>
                        <button 
                            type="button"
                            onClick={() => { setShowTutorial(true); setTutorialStep(0); }}
                            className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-black hover:scale-105 transition-all flex items-center gap-1 shrink-0"
                            title="عرض المساعد الذكي للشرح"
                        >
                            <HelpCircle size={16} />
                            <span className="hidden sm:inline">الشرح الذكي</span>
                        </button>
                    </div>

                    <form onSubmit={handleUnlock} className="space-y-5">
                        {/* 1. Passcode Input */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                <span>1. رمز المرور المعتمد للجلسة (4 أرقام) *</span>
                                {passcodeError && <span className="text-rose-500 text-[11px] font-bold">رمز غير صحيح</span>}
                            </label>
                            <input 
                                id="passcode-input"
                                type="password"
                                required
                                value={passcode}
                                onChange={e => setPasscode(e.target.value)}
                                placeholder="••••"
                                maxLength={8}
                                className={`w-full p-3.5 text-center bg-slate-50 dark:bg-slate-800/80 border rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xl font-black tracking-widest dark:text-white transition-all ${passcodeError ? 'border-red-500 ring-4 ring-red-500/15' : 'border-slate-200 dark:border-slate-700'}`}
                            />
                        </div>

                        {/* 2. Manager Full Name Input */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                                2. اسم مسؤول المخزن القائم بالجرد *
                            </label>
                            <input 
                                id="manager-name-input"
                                type="text"
                                required
                                value={managerName}
                                onChange={e => setManagerName(e.target.value)}
                                placeholder="اكتب اسمك الثلاثي بالكامل"
                                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-bold dark:text-white transition-all"
                            />
                        </div>

                        {/* 3. Signature Pad */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                    <PenTool size={14} className="text-indigo-600" />
                                    3. التوقيع الرقمي المعتمد *
                                </label>
                                <button type="button" onClick={clearSignature} className="text-[10px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors">
                                    <RotateCcw size={12} /> مسح وإعادة الرسم
                                </button>
                            </div>
                            <div id="signature-pad-container" className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 overflow-hidden touch-none">
                                <canvas
                                    ref={canvasRef}
                                    width={500}
                                    height={130}
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
                                    className="w-full h-32 cursor-crosshair block"
                                />
                                {!hasSigned && !managerSignature && (
                                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs font-black gap-1.5">
                                        <Zap size={20} className="opacity-40 text-indigo-500" />
                                        <span>وقع بإصبعك أو بالماوس هنا</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="pt-2 flex flex-col sm:flex-row gap-3">
                            <button 
                                id="unlock-session-btn"
                                type="submit" 
                                className={`flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-black shadow-xl shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group ${tutorialStep === 4 ? 'ring-4 ring-indigo-500 animate-pulse' : ''}`}
                            >
                                <span>فتح الجلسة وبدء العد الميداني</span>
                                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </button>

                            {isBiometricSupported && (
                                <button 
                                    type="button"
                                    onClick={handleBiometricAuth}
                                    className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-sm font-black hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 shrink-0"
                                    title="الدخول السريع بالبصمة"
                                >
                                    <Fingerprint size={20} className="text-indigo-600" />
                                    <span className="hidden sm:inline">البصمة</span>
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    // Main Submit Form View (Unlocked and Audit loaded)
    if (audit) {
        const isEditable = audit.status === 'pending' || audit.status === 'rejected';

        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 font-sans dir-rtl">
                {/* Focus Mode Overlay */}
                {isFocusMode && (
                    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in zoom-in duration-300">
                        <button 
                            onClick={() => setIsFocusMode(false)}
                            className="absolute top-8 right-8 p-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all"
                        >
                            <XCircle size={32}/>
                        </button>
                        
                        <div className="w-full max-w-2xl space-y-10 text-center">
                            <div className="space-y-2">
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/20 text-indigo-400 rounded-full border border-indigo-500/30 text-sm font-black uppercase tracking-widest">
                                    <Zap size={16} className="animate-pulse"/> وضع التركيز النشط
                                </div>
                                <h2 className="text-4xl font-black text-white">ابدأ بالمسح الضوئي الآن</h2>
                                <p className="text-slate-400 font-bold">هذا الوضع مخصص للسرعة القصوى. استخدم قارئ الباركود اليدوي مباشرة.</p>
                            </div>

                            <form 
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    const input = (e.currentTarget.elements.namedItem('focusBarcode') as HTMLInputElement);
                                    if (input.value) {
                                        handleBarcodeScanned(input.value);
                                        input.value = '';
                                    }
                                }} 
                                className="relative group"
                            >
                                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl blur opacity-25 group-focus-within:opacity-100 transition duration-1000 group-focus-within:duration-200"></div>
                                <input 
                                    name="focusBarcode"
                                    autoFocus
                                    placeholder="امسح الباركود هنا..."
                                    className="relative w-full bg-slate-900 border-2 border-white/10 rounded-2xl px-8 py-6 text-3xl font-black text-white text-center outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700"
                                    onBlur={(e) => e.target.focus()} // Keep focus
                                />
                                <div className="mt-4 flex justify-center gap-6">
                                    <div className="flex flex-col items-center">
                                        <span className="text-indigo-400 text-3xl font-black">{countedCount}</span>
                                        <span className="text-[10px] text-slate-500 font-bold uppercase">صنف تم عدّه</span>
                                    </div>
                                    <div className="w-px h-10 bg-white/10" />
                                    <div className="flex flex-col items-center">
                                        <span className="text-emerald-400 text-3xl font-black">{progressPercentage}%</span>
                                        <span className="text-[10px] text-slate-500 font-bold uppercase">التقدم</span>
                                    </div>
                                </div>
                            </form>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 bg-white/5 rounded-3xl border border-white/10 text-right">
                                    <span className="text-[10px] text-slate-500 block font-bold uppercase mb-2">الرف الحالي</span>
                                    <div className="flex items-center gap-3 justify-end">
                                        <span className="text-xl font-black text-white">{activeZone || 'غير محدد'}</span>
                                        <MapPin className="text-indigo-500"/>
                                    </div>
                                </div>
                                <div className="p-6 bg-white/5 rounded-3xl border border-white/10 text-right">
                                    <span className="text-[10px] text-slate-500 block font-bold uppercase mb-2">المساعد الصوتي</span>
                                    <div className="flex items-center gap-3 justify-end">
                                        <span className="text-xl font-black text-white">{isVoiceEnabled ? 'مفعل' : 'معطل'}</span>
                                        <Mic className={isVoiceEnabled ? 'text-emerald-500' : 'text-slate-500'}/>
                                    </div>
                                </div>
                            </div>

                            {/* Recent Scans in Focus Mode */}
                            <div className="w-full max-w-lg mx-auto pt-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">آخر العمليات</h4>
                                    <span className="w-12 h-px bg-white/10" />
                                </div>
                                <div className="space-y-2">
                                    {recentScans.map((scan, idx) => (
                                        <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/5 animate-in slide-in-from-top-2 duration-300 ${idx === 0 ? 'ring-2 ring-indigo-500/80 scale-[1.05] shadow-2xl shadow-indigo-500/20 bg-indigo-500/10' : 'opacity-60'}`}>
                                            <span className="text-[10px] font-mono text-slate-500">{scan.time}</span>
                                            <span className="text-sm font-black text-white">{scan.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Scanner Modal */}
                {isScannerOpen && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/85 backdrop-blur-md">
                        <div className="bg-white dark:bg-slate-950 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col animate-in zoom-in-95 duration-200">
                            <div className="p-5 bg-indigo-600 text-white flex justify-between items-center">
                                <h4 className="font-extrabold text-sm flex items-center gap-2">
                                    <Camera size={20}/>
                                    ماسح الباركود
                                </h4>
                                <button onClick={() => setIsScannerOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all">
                                    <XCircle size={20}/>
                                </button>
                            </div>
                            <div className="p-6 flex flex-col items-center gap-4 text-center">
                                <div className="relative w-full aspect-square max-w-sm rounded-2xl overflow-hidden border-2 border-dashed border-indigo-400 bg-black">
                                    <div id="reader" className="w-full h-full" />
                                    {scannerError && (
                                        <div className="absolute inset-0 bg-slate-950/90 text-red-400 p-4 flex flex-col items-center justify-center gap-2 text-xs font-bold">
                                            <AlertTriangle size={24}/>
                                            <p>{scannerError}</p>
                                        </div>
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">وجه الكاميرا نحو الباركود ليتم التعرف عليه تلقائياً</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Status Bar Banner */}
                <div className={`w-full py-3 px-4 text-center text-xs font-black text-white shadow-sm flex items-center justify-center gap-2 ${
                    audit.status === 'pending' ? 'bg-indigo-600' :
                    audit.status === 'submitted' ? 'bg-amber-500' :
                    audit.status === 'approved' ? 'bg-emerald-600' : 'bg-rose-600'
                }`}>
                    <ClipboardList size={15} />
                    <span>
                        {audit.status === 'pending' && 'جلسة جرد نشطة - يرجى جرد الأصناف بدقة وإدخال الكميات الفعلية والتوقيع'}
                        {audit.status === 'submitted' && 'تم تسليم الجرد - بانتظار مراجعة واعتماد التاجر المالي للفروقات'}
                        {audit.status === 'approved' && 'تم اعتماد الجرد وتعديل مخزون النظام الموحد بالكامل'}
                        {audit.status === 'rejected' && '⚠️ تم إرجاع ورفض هذا الجرد بواسطة التاجر - يرجى مراجعة سبب الرفض وإعادة العد'}
                    </span>
                </div>

                {isUnlocked && (
                    <>
                        {/* Redesigned Sticky Header */}
                        <div className="sticky top-0 z-[60] backdrop-blur-md bg-white/95 dark:bg-slate-900/95 border-b border-slate-200/80 dark:border-slate-800/80 shadow-sm transition-all duration-300">
                            <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black shadow-md shadow-indigo-600/10">
                                        <ClipboardList size={18} />
                                    </div>
                                    <div>
                                        <h2 className="text-xs font-black text-slate-800 dark:text-white line-clamp-1">{audit?.title || "رابط جرد خارجي"}</h2>
                                        <p className="text-[9px] text-slate-400 font-bold flex items-center gap-1">
                                            <MapPin size={10} className="text-indigo-500" />
                                            {audit?.warehouseName || 'المخزن الرئيسي'}
                                        </p>
                                    </div>
                                </div>

                                {/* Connection & Status Badges */}
                                <div className="flex items-center gap-2">
                                    {isOnline ? (
                                        <span className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-black rounded-lg flex items-center gap-1 border border-emerald-150 dark:border-emerald-900/30">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            متصل بالإنترنت • سحابي متزامن ✅
                                        </span>
                                    ) : (
                                        <span className="px-2 py-1 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-[9px] font-black rounded-lg flex items-center gap-1 border border-rose-150 dark:border-rose-900/30 animate-pulse">
                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                            غير متصل • الحفظ التلقائي محلي نشط 💾
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Floating Progress Pill */}
                        {isEditable && (
                            <div className="fixed bottom-24 left-4 z-40 pointer-events-none md:pointer-events-auto">
                                <div className="bg-slate-900 text-white dark:bg-indigo-950 dark:text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-800 dark:border-indigo-850 flex items-center gap-3">
                                    <div className="relative w-10 h-10 flex items-center justify-center bg-indigo-600 text-white font-black rounded-xl text-xs">
                                        {progressPercentage}%
                                    </div>
                                    <div className="space-y-0.5">
                                        <span className="text-[9px] text-slate-400 block font-black uppercase">تقدم العد الفعلي</span>
                                        <span className="text-xs font-black block">تم إنجاز {countedCount} من {audit?.items?.length || 0} صنف</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Bottom Action Bar */}
                        {isEditable && (
                            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 py-3 px-4 shadow-lg flex items-center justify-between gap-4 max-w-4xl mx-auto rounded-t-3xl">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 hidden sm:inline">تقدم العد: {progressPercentage}%</span>
                                    <div className="w-24 h-2 bg-slate-100 dark:bg-slate-850 rounded-full overflow-hidden p-0.5 shadow-inner hidden sm:block">
                                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%` }} />
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 flex-1 justify-end">
                                    {/* Barcode Quick Scan button in center */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsScannerOpen(true);
                                            playBeepSound();
                                        }}
                                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-indigo-600/15 transition-all active:scale-95"
                                    >
                                        <Zap size={14} className="animate-pulse text-amber-300" />
                                        مسح سريع للباركود 🎯
                                    </button>

                                    <button
                                        type="button"
                                        onClick={async () => {
                                            // Save Draft
                                            await handleConfirmItem("draft_save_dummy", 0);
                                            playSuccessSound();
                                            customAlert("تم الحفظ", "تم حفظ مسودة الجرد بنجاح في السحابة ومحلياً.", "success");
                                        }}
                                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:text-slate-350 text-slate-700 rounded-xl text-xs font-black transition-all active:scale-95"
                                    >
                                        حفظ مسودة
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            const element = document.getElementById("final-submit-section");
                                            if (element) {
                                                element.scrollIntoView({ behavior: 'smooth' });
                                            }
                                        }}
                                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition-all active:scale-95"
                                    >
                                        إنهاء وتسليم الجرد 🏁
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                <div className="max-w-4xl mx-auto px-4 mt-6 space-y-6 pb-24">
                    {/* Collaborators Info Banner */}
                    <AnimatePresence>
                        {collaboration.collaborators.length > 0 && (
                            <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden mb-4"
                            >
                                <div className="bg-indigo-50 dark:bg-indigo-950/20 border-2 border-indigo-200 dark:border-indigo-900/50 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
                                        <Users size={20} />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-sm font-black text-indigo-800 dark:text-indigo-200">فريق الجرد الميداني نشط</h3>
                                        <p className="text-[10px] text-indigo-700 dark:text-indigo-400 font-bold leading-relaxed">
                                            يوجد {collaboration.collaborators.length} زملاء آخرين يعملون معك حالياً على نفس ورقة الجرد. يتم مزامنة التغييرات والباركود فوراً.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                                <FileText size={20} />
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-slate-800 dark:text-white">نموذج جرد المخزن</h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">كود الجلسة: {audit.id.slice(0, 8)}</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => {
                                setShowTutorial(true);
                                setTutorialStep(0);
                            }}
                            className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 transition-all text-xs font-black flex items-center gap-2"
                        >
                            <HelpCircle size={16} /> المساعدة
                        </button>
                    </div>

                    {/* Rejection Notice Banner if rejected */}
                    {audit.status === 'rejected' && (
                        <div className="relative overflow-hidden bg-gradient-to-br from-rose-500/10 to-rose-600/5 dark:from-rose-500/5 dark:to-rose-600/5 border border-rose-200 dark:border-rose-900/50 rounded-[2rem] p-6 sm:p-8 shadow-sm space-y-5 group animate-in slide-in-from-top-4 duration-500">
                            <div className="absolute top-0 left-0 p-8 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-700">
                                <AlertTriangle size={160} />
                            </div>
                            
                            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ring-4 ring-rose-50 dark:ring-rose-900/20">
                                    <AlertTriangle size={32} className="animate-pulse" />
                                </div>
                                <div className="space-y-1.5 flex-1">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-600 text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-sm">
                                        <RotateCcw size={12} />
                                        جرد مُعاد ومرفوض
                                    </div>
                                    <h3 className="text-xl font-black text-slate-800 dark:text-white">
                                        تم رفض تسليم الجرد من قبل إدارة التاجر
                                    </h3>
                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                                        يرجى مراجعة سبب الرفض أدناه، وإعادة التحقق من الأرصدة والمخزون الفعلي، ثم إعادة إرسال الجرد للمراجعة مرة أخرى.
                                    </p>
                                </div>
                            </div>
                            
                            <div className="relative z-10 p-5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-rose-100 dark:border-rose-900/30 space-y-2">
                                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                                    <FileText size={16} />
                                    <span className="text-[11px] font-black uppercase tracking-widest">
                                        سبب الرفض وملاحظات التاجر المالي:
                                    </span>
                                </div>
                                <p className="text-sm font-black text-slate-800 dark:text-slate-200 leading-relaxed pr-6 border-r-2 border-rose-200 dark:border-rose-800">
                                    "{audit.rejectReason || 'توجد فروقات غير مبررة في المخزون، يرجى إعادة العد الدقيق بالقطعة وتأكيد الكميات الفعلية ومطابقتها.'}"
                                </p>
                            </div>
                        </div>
                    )}

                    {isEditable ? (
                        <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-500">
                            {/* Header Info Card */}
                            <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
                        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-8 shadow-sm space-y-4 relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-500/5 rounded-full -translate-x-16 -translate-y-16 group-hover:scale-110 transition-transform duration-700" />
                            <div className="flex items-center gap-3 relative">
                                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                                    <ClipboardList size={28}/>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black rounded-full uppercase tracking-tighter shadow-sm">جرد خارجي مباشر</span>
                                        <span className="text-slate-400 text-[10px] font-bold tracking-widest">{new Date(audit.createdAt).toLocaleDateString('ar-EG')}</span>
                                    </div>
                                    <h1 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">{audit.title}</h1>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-100 dark:border-slate-800 relative">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                    <MapPin size={16} className="text-indigo-500"/>
                                    <span>موقع الجرد: <strong>{audit.warehouseName || 'المخزن الرئيسي'}</strong></span>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                    <Package size={16} className="text-indigo-500"/>
                                    <span>عدد الأصناف: <strong>{audit.items.length} صنف</strong></span>
                                </div>
                            </div>
                        </div>

                        {/* Stats Dashboard */}
                        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Progress Widget */}
                            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between group">
                                <div className="flex justify-between items-start">
                                    <span className="text-[11px] text-slate-400 font-black uppercase tracking-widest">معدل الإنجاز</span>
                                    <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-xl flex items-center justify-center font-black text-xs">
                                        {progressPercentage}%
                                    </div>
                                </div>
                                <div className="space-y-3 mt-4">
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-4xl font-black text-slate-800 dark:text-white leading-none">{countedCount}</span>
                                        <span className="text-xs font-bold text-slate-400">من أصل {audit.items.length}</span>
                                    </div>
                                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 shadow-inner">
                                        <div 
                                            className="h-full bg-gradient-to-l from-emerald-500 to-emerald-600 rounded-full transition-all duration-1000 shadow-sm" 
                                            style={{ width: `${progressPercentage}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Tech Controls - Premium Look */}
                            <div className="bg-indigo-600 rounded-[2rem] p-6 shadow-xl shadow-indigo-500/20 flex flex-col justify-between text-white relative overflow-hidden">
                                <Zap className="absolute -bottom-6 -right-6 w-32 h-32 text-white/5 rotate-12" />
                                <span className="text-[11px] text-indigo-200 font-black uppercase tracking-widest relative">أدوات الجرد الذكي</span>
                                <div className="flex items-center gap-3 relative mt-4">
                                    <button
                                        onClick={() => {
                                            setIsVoiceEnabled(!isVoiceEnabled);
                                            playChangeSound();
                                            if (!isVoiceEnabled) speak('تمام، فعلنا المساعد الصوتي');
                                        }}
                                        className={`p-3.5 rounded-2xl transition-all ${isVoiceEnabled ? 'bg-white text-indigo-600' : 'bg-indigo-700 text-indigo-300'} hover:scale-105 active:scale-95`}
                                        title="المساعد الصوتي"
                                    >
                                        {isVoiceEnabled ? <Volume2 size={24}/> : <VolumeX size={24}/>}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsFocusMode(!isFocusMode);
                                            playChangeSound();
                                            if (!isFocusMode) speak('فعلنا وضع التركيز، يلا بينا');
                                        }}
                                        className={`p-3.5 rounded-2xl transition-all ${isFocusMode ? 'bg-amber-400 text-white shadow-lg' : 'bg-indigo-700 text-indigo-300'} hover:scale-105 active:scale-95`}
                                        title="وضع التركيز"
                                    >
                                        <Target size={24}/>
                                    </button>
                                    <button
                                        id="scanner-button"
                                        onClick={() => {
                                            setIsScannerOpen(true);
                                            playBeepSound();
                                        }}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3.5 bg-white text-indigo-600 dark:bg-slate-800 dark:text-indigo-400 rounded-2xl font-black text-sm shadow-md hover:scale-[1.02] active:scale-95 transition-all border border-slate-200 dark:border-slate-700 ${tutorialStep === 6 ? 'ring-4 ring-indigo-500 animate-pulse' : ''}`}
                                    >
                                        <Camera size={20}/>
                                        فتح الكاميرا
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Modern Dynamic Tab Selector */}
                    <div className="flex bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/80 rounded-2xl p-1 shadow-sm gap-1 overflow-x-auto scrollbar-none dir-rtl mb-6">
                        <button
                            type="button"
                            onClick={() => { setActiveTab('dashboard'); playChangeSound(); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                                activeTab === 'dashboard'
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                            }`}
                        >
                            <BarChart3 size={16} />
                            <span>نظرة عامة والسرعة 🎯</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => { setActiveTab('worksheet'); playChangeSound(); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                                activeTab === 'worksheet'
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                            }`}
                        >
                            <ClipboardList size={16} />
                            <span>واجهة جرد الكميات 🔢 ({audit.items.length})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => { setActiveTab('sessions'); playChangeSound(); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                                activeTab === 'sessions'
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                            }`}
                        >
                            <Lock size={16} />
                            <span>القرارات والمشرفين 🛡️</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => { setActiveTab('notifications'); playChangeSound(); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap relative ${
                                activeTab === 'notifications'
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                            }`}
                        >
                            <AlertCircle size={16} />
                            <span>مركز التنبيهات 🔔</span>
                            {/* Dynamic indicator badge for notifications count */}
                            {((audit.status === 'rejected' ? 1 : 0) + 
                              (audit.items.some(item => {
                                  const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
                                  return counts[key] !== undefined && Math.abs(counts[key] - item.systemQty) >= 10;
                              }) ? 1 : 0) + 
                              ((audit.items.length - countedCount) > 0 ? 1 : 0)) > 0 && (
                                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setActiveTab('reports'); playChangeSound(); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                                activeTab === 'reports'
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                            }`}
                        >
                            <Activity size={16} />
                            <span>التحليلات والمطابقة 📊</span>
                        </button>
                    </div>

                    {/* Conditional Worksheet View Render */}
                    {activeTab === 'worksheet' && (
                        <div className="space-y-6">
                            <SharedCountingExperience 
                                audit={audit}
                                counts={counts}
                                setCounts={setCounts}
                                itemNotes={itemNotes}
                                setItemNotes={setItemNotes}
                                itemPhotos={itemPhotos}
                                setItemPhotos={setItemPhotos}
                                activeZone={activeZone}
                                setActiveZone={setActiveZone}
                                speak={speak}
                                triggerHaptic={triggerHaptic}
                                onPhotoCapture={handlePhotoCapture}
                                isListening={isListening}
                                activeVoiceField={activeVoiceField}
                                handleVoiceInput={handleVoiceInput}
                                showSystemQty={showSystemQty}
                                onStartScanner={() => {
                                    setIsScannerOpen(true);
                                    playBeepSound();
                                }}
                                collaboration={collaboration}
                            />

                            {/* Redesigned Unified Signature and Final Submission Card */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6 text-right dir-rtl">
                                <div className="flex items-center gap-3 border-b border-slate-150 dark:border-slate-850 pb-4">
                                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                                        <CheckCircle2 size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-800 dark:text-white text-sm">تسليم واعتماد الجلسة</h3>
                                        <p className="text-[10px] text-slate-400 font-bold">يرجى كتابة الملاحظات الختامية للتسليم النهائي والمطابقة</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">مسؤول المخزن المُقر:</p>
                                            <p className="font-black text-slate-800 dark:text-white flex items-center gap-2 mt-1">
                                                <User size={16} className="text-indigo-500" />
                                                {managerName || "مسؤول معتمد"}
                                            </p>
                                            {(managerSignature || audit.signatureData) && (
                                                <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex justify-center">
                                                    <img src={managerSignature || audit.signatureData} alt="Signature" className="h-12 object-contain opacity-90" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs text-slate-500 dark:text-slate-400 font-bold block mb-1">ملاحظات عامة حول جرد اليوم (اختياري)</label>
                                        <textarea 
                                            value={managerNotes}
                                            onChange={e => setManagerNotes(e.target.value)}
                                            placeholder="أية ملاحظات ختامية للتاجر حول البضائع، الترتيب أو حالة الأرفف..."
                                            className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-150 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs font-bold dark:text-white h-24 resize-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-150 dark:border-slate-850 flex flex-col sm:flex-row justify-between items-center gap-4">
                                    <div className="text-right space-y-1">
                                        <span className="text-xs text-slate-400 font-bold block">إجمالي تقدم عملية العد الميداني والتوقيع</span>
                                        <span className="text-xs font-black text-slate-800 dark:text-white block">
                                            تم إحصاء <strong className="text-indigo-600 font-mono text-sm">{countedCount}</strong> من أصل <strong className="font-mono text-sm">{audit.items.length}</strong> صنوف بالكامل
                                        </span>
                                    </div>

                                    <button 
                                        onClick={handleSubmit}
                                        className="w-full sm:w-auto px-7 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer"
                                    >
                                        <Save size={16} />
                                        إرسال وتسليم عهدة الجرد والتوقيع للتاجر
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Legacy worksheet render deactivated */}
                    {false && (
                        <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-300">
                            {/* Zone & Search Bar - Re-styled */}
                            <div className="flex flex-col lg:flex-row gap-4 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] shadow-sm relative overflow-hidden group">
                        {isFocusMode && <div className="absolute inset-0 bg-indigo-600/5 animate-pulse pointer-events-none" />}
                        
                        <div className="flex items-center gap-4 flex-1">
                            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                                <MapPin size={22}/>
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block mb-0.5">الرف أو القطاع الحالي</label>
                                <input 
                                    type="text"
                                    value={activeZone}
                                    onChange={e => {
                                        setActiveZone(e.target.value);
                                        playChangeSound();
                                    }}
                                    placeholder="مثال: الرف A1، القطاع الرئيسي..."
                                    className="w-full p-2 bg-transparent border-none rounded-xl text-sm font-black outline-none focus:ring-0 dark:text-white placeholder:text-slate-300"
                                />
                            </div>
                        </div>

                        <div className="h-12 w-px bg-slate-100 dark:bg-slate-800 hidden lg:block" />

                        <div className="flex items-center gap-4 flex-[1.5]">
                            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-2xl flex items-center justify-center shrink-0">
                                <Search size={22}/>
                            </div>
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="ابحث باسم المنتج أو الباركود..."
                                className="w-full p-2 bg-transparent border-none rounded-xl text-sm font-black outline-none focus:ring-0 dark:text-white placeholder:text-slate-300"
                            />
                        </div>
                    </div>

                    {/* Locked Identity Badge (Grayed Out Read-Only After Login) */}
                    <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-inner space-y-3 dir-rtl text-right">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-700/80">
                            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-extrabold text-xs">
                                <Lock size={15} className="text-indigo-600 dark:text-indigo-400" />
                                <span>هوية مسؤول الجرد المعتمدة للجلسة (مقفولة بالرمادي وغير قابلة للتعديل)</span>
                            </div>
                            <span className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-black rounded-lg border border-slate-300 dark:border-slate-600 flex items-center gap-1">
                                <CheckCircle size={12} className="text-emerald-500" /> موثقة ومحفوظة
                            </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                            <div className="space-y-1">
                                <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">اسم المسؤول القائم بالجرد *</label>
                                <input 
                                    type="text"
                                    disabled
                                    readOnly
                                    value={managerName || (auditId && localStorage.getItem(`audit_manager_name_${auditId}`)) || localStorage.getItem('audit_manager_name') || 'مسؤول مخزن معتمد'}
                                    className="w-full p-3 bg-slate-200/70 dark:bg-slate-900/80 border border-slate-300/80 dark:border-slate-700 rounded-xl text-sm font-black text-slate-600 dark:text-slate-400 cursor-not-allowed select-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">التوقيع الرقمي الموثق بالجلسة *</label>
                                <div className="p-2 bg-slate-200/70 dark:bg-slate-900/80 border border-slate-300/80 dark:border-slate-700 rounded-xl flex items-center justify-between h-12">
                                    <span className="text-[10px] font-bold text-slate-500 mr-2">التوقيع الإلكتروني:</span>
                                    {(managerSignature || audit.signatureData) ? (
                                        <img src={managerSignature || audit.signatureData} alt="التوقيع الرقمي" className="h-8 max-w-[160px] object-contain bg-white rounded p-0.5 border" />
                                    ) : (
                                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">تم التوقيع المعتمد ✍️</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Live Audit Tracker & Missing Items ("ناقص إيه") Smart Results Card */}
                    <div id="inventory-summary-card" className="bg-white dark:bg-slate-900 border-2 border-indigo-500/20 dark:border-indigo-500/30 rounded-3xl p-5 shadow-xl space-y-4 dir-rtl text-right">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                                    <BarChart3 size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 dark:text-white text-sm">نتائج الجرد المباشرة (حصر الكميات والمتبقي)</h3>
                                    <p className="text-[10px] text-slate-400 font-bold">متابعة فورية لحظة بلحظة للقطائع والأصناف المجرودة والمتبقية</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1.5 rounded-xl">
                                <span>النسبة الإجمالية:</span>
                                <span>{progressPercentage}%</span>
                            </div>
                        </div>

                        {/* 4 Interactive Key Metric Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {/* Card 1: Total Items */}
                            <button 
                                type="button"
                                onClick={() => setFilterMode('all')}
                                className={`p-3.5 rounded-2xl border text-right transition-all hover:scale-[1.02] ${filterMode === 'all' ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/30' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'}`}
                            >
                                <span className="text-[10px] text-slate-500 font-bold block mb-1">إجمالي الأصناف</span>
                                <div className="text-xl font-black text-slate-800 dark:text-white">{audit.items.length}</div>
                                <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold">عرض الكل</span>
                            </button>

                            {/* Card 2: Counted Items */}
                            <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl text-right">
                                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold block mb-1">تم حصرها</span>
                                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">{countedCount}</div>
                                <span className="text-[9px] text-emerald-600/80 font-bold">{progressPercentage}% إنجاز</span>
                            </div>

                            {/* Card 3: Remaining Items ("ناقص إيه") */}
                            <button 
                                type="button"
                                onClick={() => {
                                    setFilterMode('uncounted');
                                    speak("عرض الأصناف المتبقية ناقص إيه");
                                }}
                                className={`p-3.5 rounded-2xl border text-right transition-all hover:scale-[1.02] relative overflow-hidden ${
                                    (audit.items.length - countedCount) > 0 ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/30' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                                }`}
                            >
                                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-black block mb-1 flex items-center justify-between">
                                    <span>ناقص إيه؟ (متبقي)</span>
                                    {(audit.items.length - countedCount) > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />}
                                </span>
                                <div className="text-xl font-black text-amber-600 dark:text-amber-400">
                                    {audit.items.length - countedCount}
                                </div>
                                <span className="text-[9px] text-amber-700 dark:text-amber-400 font-black underline">اضغط لعرض المتبقي فقط 🔍</span>
                            </button>

                            {/* Card 4: Total Physical Units Entered */}
                            <div className="p-3.5 bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40 rounded-2xl text-right">
                                <span className="text-[10px] text-purple-700 dark:text-purple-400 font-bold block mb-1">إجمالي القطع الفعلية</span>
                                <div className="text-xl font-black text-purple-600 dark:text-purple-400">
                                    {Object.values(counts).reduce((acc, curr) => acc + (Number(curr) || 0), 0)}
                                </div>
                                <span className="text-[9px] text-purple-600/80 font-bold">وحدة محصورة</span>
                            </div>
                        </div>

                        {/* Interactive Banner to view missing items */}
                        {(audit.items.length - countedCount) > 0 && filterMode !== 'uncounted' && (
                            <button
                                type="button"
                                onClick={() => {
                                    setFilterMode('uncounted');
                                    speak("تم تصفية القائمة لعرض الأصناف المتبقية ناقص إيه");
                                }}
                                className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl text-xs font-black shadow-md hover:brightness-105 transition-all flex items-center justify-between"
                            >
                                <span className="flex items-center gap-2">
                                    <AlertCircle size={16} />
                                    تنبيه: فاضل {audit.items.length - countedCount} صنف في القائمة لم يتم عدّهم بعد
                                </span>
                                <span className="bg-white/20 px-3 py-1 rounded-lg text-[10px] font-black underline">عرض الأصناف المتبقية (ناقص إيه)</span>
                            </button>
                        )}
                    </div>

                    {/* Products Count List container */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-50/50 dark:bg-slate-800/10">
                            <div className="space-y-1">
                                <h3 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-1.5">
                                    <Package size={16} className="text-indigo-600" />
                                    قائمة السلع والكميات الميدانية المراد حصرها
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium">الرجاء عد كل صنف في المستودع وإدخال الكمية الفعلية الموجودة على الرف حالياً.</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                {/* Toggle blind count - Only visible if merchant didn't force blind count */}
                                {!audit?.isBlindCount && (
                                    <button
                                        type="button"
                                        onClick={() => setShowSystemQty(prev => !prev)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 ${
                                            showSystemQty 
                                                ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/20 dark:border-indigo-900/30 dark:text-indigo-400' 
                                                : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-500'
                                        }`}
                                    >
                                        <Info size={13} />
                                        {showSystemQty ? 'إخفاء الكمية الدفترية للنظام' : 'إظهار الكمية الدفترية المبرمجة'}
                                    </button>
                                )}
                                {audit?.isBlindCount && (
                                    <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg text-[10px] font-black flex items-center gap-1.5 border border-slate-200 dark:border-slate-700">
                                        <Lock size={12} className="text-indigo-500" />
                                        نظام الجرد الأعمى نشط (🔒 الرصيد الدفتري مخفي)
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Search & Filter bar inside worksheet */}
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
                            <div className="relative flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input 
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="ابحث عن اسم المنتج، الصنف أو الباركود SKU..."
                                        className="w-full pr-11 pl-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-xs font-bold dark:text-white transition-all"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleVoiceInput('search')}
                                    className={`p-3 rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0 ${
                                        activeVoiceField === 'search' && isListening 
                                            ? 'bg-rose-500 text-white animate-pulse' 
                                            : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400'
                                    }`}
                                >
                                    <Mic size={20} />
                                </button>
                            </div>

                            {/* Filter Chips */}
                            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setFilterMode('all')}
                                    className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${filterMode === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                                >
                                    جميع الأصناف ({audit.items.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterMode('uncounted')}
                                    className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${filterMode === 'uncounted' ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                                >
                                    غير المردودة / صفرية
                                </button>
                                {showSystemQty && (
                                    <button
                                        type="button"
                                        onClick={() => setFilterMode('discrepancy')}
                                        className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${filterMode === 'discrepancy' ? 'bg-rose-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                                    >
                                        أصناف بها فارق عجز/زيادة
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Products worksheet items */}
                        {filteredItems.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 space-y-2">
                                <Package className="mx-auto opacity-20 text-slate-400" size={40} />
                                <p className="text-xs font-bold text-slate-500">لا توجد نتائج بحث مطابقة للمرشح المختار</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredItems.map((item, index) => {
                                    const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
                                    const countValue = counts[key] ?? 0;
                                    const noteValue = itemNotes[key] ?? '';

                                    return (
                                        <div 
                                            key={key} 
                                            id={index === 0 ? "first-product-item" : undefined}
                                            className={`p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all group border-b border-slate-100 dark:border-slate-800 last:border-0 ${
                                                counts[key] !== undefined 
                                                    ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-r-4 border-r-emerald-500' 
                                                    : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'
                                            }`}
                                        >
                                            {/* Left: Product Info */}
                                            <div className="flex items-start gap-4 flex-1">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shadow-inner shrink-0 transition-colors ${
                                                    counts[key] !== undefined 
                                                        ? 'bg-emerald-100 text-emerald-600' 
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'
                                                }`}>
                                                    {counts[key] !== undefined ? <CheckCircle2 size={20} /> : index + 1}
                                                </div>
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-black text-slate-800 dark:text-white text-sm leading-tight group-hover:text-indigo-600 transition-colors">{item.name}</h4>
                                                        {counts[key] !== undefined && (
                                                            <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-[9px] font-black rounded-full uppercase tracking-tighter">تم الجرد</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-lg text-[10px] font-bold text-slate-400 font-mono tracking-tight uppercase">SKU: {item.sku || 'N/A'}</span>
                                                        {showSystemQty && (
                                                            <div className="inline-flex items-center gap-1.5 text-[10px] font-black text-indigo-500">
                                                                <Info size={12}/>
                                                                <span>السيستم بيقول: <strong className="font-mono">{item.systemQty}</strong></span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right: Actual counted input with quick +/- buttons & notes */}
                                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
                                                <div className="flex flex-col items-center">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            disabled={!isEditable}
                                                            onClick={() => {
                                                                setCounts(prev => {
                                                                    const current = prev[key] || 0;
                                                                    const next = Math.max(0, current - 1);
                                                                    audioSynth.playTone('click');
                                                                    return { ...prev, [key]: next };
                                                                });
                                                            }}
                                                            className="w-12 h-12 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl text-slate-600 dark:text-slate-300 font-black text-xl flex items-center justify-center transition-all disabled:opacity-50 active:scale-90"
                                                        >
                                                            -
                                                        </button>
                                                        <input 
                                                            id={`count-input-${index}`}
                                                            type="number"
                                                            min="0"
                                                            disabled={!isEditable}
                                                            value={countValue}
                                                            onChange={e => {
                                                                const val = e.target.value === '' ? 0 : Math.max(0, Number(e.target.value));
                                                                setCounts(prev => ({ ...prev, [key]: val }));
                                                            }}
                                                            onKeyDown={e => handleKeyDown(e, index)}
                                                            className="w-20 h-12 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-center text-lg font-black dark:text-white outline-none focus:border-indigo-500 transition-all"
                                                        />
                                                        <button
                                                            type="button"
                                                            disabled={!isEditable}
                                                            onClick={() => {
                                                                setCounts(prev => {
                                                                    const current = prev[key] || 0;
                                                                    const next = current + 1;
                                                                    audioSynth.playTone('click');
                                                                    return { ...prev, [key]: next };
                                                                });
                                                            }}
                                                            className="w-12 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xl flex items-center justify-center transition-all disabled:opacity-50 shadow-md shadow-indigo-600/10 active:scale-90"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="flex-1 md:w-64 flex items-center gap-2">
                                                    <div className="relative flex-1">
                                                        <FileText className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                                                        <input 
                                                            type="text"
                                                            disabled={!isEditable}
                                                            value={noteValue}
                                                            onChange={e => setItemNotes(prev => ({ ...prev, [key]: e.target.value }))}
                                                            placeholder="ضيف ملاحظة هنا..."
                                                            className="w-full pr-10 pl-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 dark:text-white disabled:opacity-70 transition-all"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleVoiceInput(key)}
                                                            className={`absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${
                                                                activeVoiceField === key && isListening 
                                                                    ? 'text-rose-500' 
                                                                    : 'text-slate-400 hover:text-indigo-500'
                                                            }`}
                                                        >
                                                            <Mic size={14} />
                                                        </button>
                                                    </div>

                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <label className="cursor-pointer p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-2xl transition-all shadow-sm">
                                                            <Camera size={18} />
                                                            <input 
                                                                type="file" 
                                                                accept="image/*" 
                                                                capture="environment"
                                                                className="hidden" 
                                                                onChange={e => handlePhotoCapture(key, e.target.files?.[0] || null)}
                                                            />
                                                        </label>
                                                        {itemPhotos[key] && (
                                                            <div className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-emerald-500/30 group/photo cursor-zoom-in">
                                                                <img 
                                                                    src={itemPhotos[key]} 
                                                                    className="w-full h-full object-cover transition-transform group-hover/photo:scale-110" 
                                                                    onClick={() => setFullImageView(itemPhotos[key])}
                                                                />
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setItemPhotos(prev => {
                                                                            const next = {...prev};
                                                                            delete next[key];
                                                                            return next;
                                                                        });
                                                                    }}
                                                                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity"
                                                                >
                                                                    <Trash2 size={14} className="text-white" />
                                                                </button>
                                                            </div>
                                                        )}
                                                        
                                                        {/* Manual Confirm & Save Button */}
                                                        <div className="relative">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const currentVal = counts[key] !== undefined ? counts[key] : (countValue || 0);
                                                                    handleConfirmItem(key, currentVal);
                                                                }}
                                                                className={`p-3 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-1.5 ${
                                                                    counts[key] !== undefined 
                                                                        ? 'bg-emerald-600 text-white shadow-emerald-500/20 ring-2 ring-emerald-500/30 hover:bg-emerald-700' 
                                                                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-600 hover:text-emerald-600'
                                                                }`}
                                                                title={counts[key] !== undefined ? 'تم جرد وحفظ هذا الصنف (اضغط لتحديث الحفظ)' : 'تأكيد جرد هذا الصنف وحفظه الآن'}
                                                            >
                                                                <CheckCircle2 size={18} />
                                                                {counts[key] !== undefined && (
                                                                    <span className="text-[10px] font-black pl-0.5 hidden sm:inline">محفوظ</span>
                                                                )}
                                                            </button>
                                                            
                                                            <AnimatePresence>
                                                                {savedToastKey === key && (
                                                                    <motion.div
                                                                        initial={{ opacity: 0, y: 8, scale: 0.9 }}
                                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                                        exit={{ opacity: 0, y: -8 }}
                                                                        className="absolute -top-10 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-black px-3 py-1 rounded-xl shadow-xl whitespace-nowrap z-30 flex items-center gap-1"
                                                                    >
                                                                        <CheckCircle size={12} />
                                                                        تم حفظ الجرد! 🟢
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Submit Actions Footer */}
                    <div id="final-submit-section" className="space-y-6">
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                                <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                                    <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                                        <CheckCircle2 size={20} />
                                    </div>
                                    <h3 className="font-black text-slate-800 dark:text-white">تأكيد نهائي وإرسال الجرد</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">مسؤول المخزن المُقر:</p>
                                            <p className="font-black text-slate-800 dark:text-white flex items-center gap-2">
                                                <User size={16} className="text-indigo-500" />
                                                {managerName}
                                            </p>
                                            {managerSignature && (
                                                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                                    <img src={managerSignature} alt="Signature" className="h-16 object-contain opacity-80" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs text-slate-500 dark:text-slate-400 font-bold block mb-1">ملاحظات عامة حول عملية جرد اليوم (اختياري)</label>
                                        <textarea 
                                            value={managerNotes}
                                            onChange={e => setManagerNotes(e.target.value)}
                                            placeholder="أية ملاحظات عامة حول البضائع، الترتيب أو حالة الأرفف..."
                                            className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-medium dark:text-white h-24 resize-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-md flex flex-col sm:flex-row justify-between items-center gap-4">
                                <div className="text-right space-y-1 w-full sm:w-auto">
                                    <span className="text-xs text-slate-400 font-bold block">إجمالي تقدم عملية العد الميداني والتوقيع</span>
                                    <span className="text-sm font-black text-slate-800 dark:text-white">
                                        تم إحصاء <strong className="text-indigo-600 font-mono text-base">{countedCount}</strong> من أصل <strong className="font-mono text-base">{audit.items.length}</strong> صنوف بالكامل
                                    </span>
                                </div>

                                <button 
                                    onClick={handleSubmit}
                                    className="w-full sm:w-auto px-7 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                                >
                                    <Save size={18} />
                                    إرسال وتسليم عهدة الجرد والتوقيع للتاجر
                                </button>
                            </div>
                        </div>
                    </div>
                    )}

                    {/* Dashboard Tab */}
                    {activeTab === 'dashboard' && (
                        <div className="space-y-6">
                            <SharedAuditHome 
                                audit={audit} 
                                countedCount={countedCount}
                                progressPercentage={progressPercentage}
                                managerName={managerName || "مسؤول مخزن معتمد"}
                                onContinue={() => {
                                    setActiveTab('worksheet');
                                    playChangeSound();
                                }}
                                speak={speak}
                            />
                        </div>
                    )}

                    {/* Legacy dashboard render deactivated */}
                    {activeTab === 'dashboard' && false && (
                        <div className="space-y-6 animate-in fade-in duration-300 dir-rtl text-right">
                            {/* Real-time Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Accuracy card */}
                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex items-center justify-between">
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase block">نسبة مطابقة الأرصدة الميدانية</span>
                                        <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                                            {audit.items.length > 0 ? Math.round((audit.items.filter(item => {
                                                const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
                                                return counts[key] !== undefined && counts[key] === item.systemQty;
                                            }).length / audit.items.length) * 100) : 0}%
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-medium">الأصناف المطابقة للكمية الدفترية بدقة</span>
                                    </div>
                                    <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center">
                                        <FileCheck2 size={28} />
                                    </div>
                                </div>

                                {/* Total surplus/deficit metric */}
                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex items-center justify-between">
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase block">صافي الفروقات الكلية</span>
                                        <div className={`text-3xl font-black ${
                                            Object.entries(counts).reduce((acc, [k, val]) => {
                                                const itemObj = audit.items.find(it => (it.variantId ? `${it.productId}_${it.variantId}` : it.productId) === k);
                                                if (!itemObj) return acc;
                                                return acc + (val - itemObj.systemQty);
                                            }, 0) >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'
                                        }`}>
                                            {Object.entries(counts).reduce((acc, [k, val]) => {
                                                const itemObj = audit.items.find(it => (it.variantId ? `${it.productId}_${it.variantId}` : it.productId) === k);
                                                if (!itemObj) return acc;
                                                return acc + (val - itemObj.systemQty);
                                            }, 0) > 0 ? '+' : ''}
                                            {Object.entries(counts).reduce((acc, [k, val]) => {
                                                const itemObj = audit.items.find(it => (it.variantId ? `${it.productId}_${it.variantId}` : it.productId) === k);
                                                if (!itemObj) return acc;
                                                return acc + (val - itemObj.systemQty);
                                            }, 0)} <span className="text-xs font-black">قطعة</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-medium">الفرق الميداني الإجمالي مقارنة بالنظام</span>
                                    </div>
                                    <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                                        <Boxes size={28} />
                                    </div>
                                </div>

                                {/* Uncounted counter */}
                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex items-center justify-between">
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase block">الأصناف المتبقية (ناقصة)</span>
                                        <div className="text-3xl font-black text-amber-500">
                                            {audit.items.length - countedCount} <span className="text-xs font-black">صنف</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-medium">أصناف متبقية تحتاج للعد والتسجيل</span>
                                    </div>
                                    <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-2xl flex items-center justify-center">
                                        <Clock size={28} />
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Charts Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                                {/* Ring donut analysis */}
                                <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                                    <h3 className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                                        <Activity size={18} className="text-indigo-600" />
                                        التحليل الهيكلي لحالة الجرد
                                    </h3>
                                    
                                    <div className="flex flex-col items-center justify-center py-4 space-y-4">
                                        {/* Raw SVG Donut Chart */}
                                        <div className="relative w-40 h-40">
                                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                                {/* Background circle */}
                                                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f1f5f9" strokeWidth="12" className="dark:stroke-slate-800" />
                                                
                                                {/* Matched portion */}
                                                <circle 
                                                    cx="50" 
                                                    cy="50" 
                                                    r="40" 
                                                    fill="transparent" 
                                                    stroke="#10b981" 
                                                    strokeWidth="12" 
                                                    strokeDasharray={2 * Math.PI * 40}
                                                    strokeDashoffset={2 * Math.PI * 40 * (1 - (audit.items.length > 0 ? audit.items.filter(item => {
                                                        const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
                                                        return counts[key] !== undefined && counts[key] === item.systemQty;
                                                    }).length : 0) / audit.items.length)}
                                                    className="transition-all duration-1000"
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                                <span className="text-2xl font-black text-slate-800 dark:text-white">{progressPercentage}%</span>
                                                <span className="text-[9px] text-slate-400 font-bold">نسبة التغطية</span>
                                            </div>
                                        </div>

                                        <div className="w-full space-y-2 text-xs">
                                            <div className="flex items-center justify-between">
                                                <span className="flex items-center gap-1.5 text-slate-500 font-bold">
                                                    <span className="w-3 h-3 rounded-full bg-emerald-500" />
                                                    مطابق تماماً للدفتر
                                                </span>
                                                <span className="font-black text-slate-800 dark:text-white font-mono">
                                                    {audit.items.filter(item => {
                                                        const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
                                                        return counts[key] !== undefined && counts[key] === item.systemQty;
                                                    }).length} صنف ({audit.items.length > 0 ? Math.round((audit.items.filter(item => {
                                                        const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
                                                        return counts[key] !== undefined && counts[key] === item.systemQty;
                                                    }).length / audit.items.length) * 100) : 0}%)
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="flex items-center gap-1.5 text-slate-500 font-bold">
                                                    <span className="w-3 h-3 rounded-full bg-rose-500" />
                                                    أصناف بها عجز أو زيادة
                                                </span>
                                                <span className="font-black text-slate-800 dark:text-white font-mono">
                                                    {audit.items.filter(item => {
                                                        const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
                                                        return counts[key] !== undefined && counts[key] !== item.systemQty;
                                                    }).length} صنف ({audit.items.length > 0 ? Math.round((audit.items.filter(item => {
                                                        const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
                                                        return counts[key] !== undefined && counts[key] !== item.systemQty;
                                                    }).length / audit.items.length) * 105 - 105) : 0}%)
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="flex items-center gap-1.5 text-slate-500 font-bold">
                                                    <span className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700" />
                                                    لم يتم عدّه بعد (ناقص)
                                                </span>
                                                <span className="font-black text-slate-800 dark:text-white font-mono">
                                                    {audit.items.length - countedCount} صنف ({audit.items.length > 0 ? Math.round(((audit.items.length - countedCount) / audit.items.length) * 100) : 0}%)
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* List of discrepancies */}
                                <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                                        <h3 className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                                            <AlertTriangle size={18} className="text-rose-500" />
                                            رصد الفروقات والعيوب (أولاً بأول)
                                        </h3>
                                        <span className="px-2 py-1 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-[10px] font-black rounded-lg">
                                            المتبقي: {audit.items.filter(item => {
                                                const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
                                                return counts[key] !== undefined && counts[key] !== item.systemQty;
                                            }).length} صنف به عجز/زيادة
                                        </span>
                                    </div>

                                    <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                                        {audit.items.filter(item => {
                                            const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
                                            return counts[key] !== undefined && counts[key] !== item.systemQty;
                                        }).length === 0 ? (
                                            <div className="py-12 text-center text-slate-400 text-xs font-bold space-y-2">
                                                <CheckCircle className="mx-auto text-emerald-500 opacity-60" size={32} />
                                                <p>لا توجد فروقات مرصودة حتى الآن. إما لم تبدأ الجرد، أو كل ما جردته مطابق تماماً للسيستم!</p>
                                            </div>
                                        ) : (
                                            audit.items.filter(item => {
                                                const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
                                                return counts[key] !== undefined && counts[key] !== item.systemQty;
                                            }).map(item => {
                                                const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
                                                const actual = counts[key];
                                                const diff = actual - item.systemQty;
                                                return (
                                                    <div key={key} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                                                        <div className="space-y-1">
                                                            <h4 className="font-black text-slate-800 dark:text-white">{item.name}</h4>
                                                            <p className="text-[10px] text-slate-400 font-bold font-mono">SKU: {item.sku}</p>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-right">
                                                                <span className="text-[10px] text-slate-400 block">الفعلي vs الدفتري</span>
                                                                <span className="font-black text-slate-700 dark:text-slate-300 font-mono">{actual} من {item.systemQty}</span>
                                                            </div>
                                                            <span className={`px-2.5 py-1 rounded-lg font-black font-mono text-xs ${
                                                                diff > 0 
                                                                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400' 
                                                                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                                                            }`}>
                                                                {diff > 0 ? `+${diff} زيادة` : `${diff} عجز`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Notifications Tab */}
                    {activeTab === 'notifications' && (
                        <div className="space-y-4">
                            <SharedNotificationCenter 
                                audit={audit} 
                                counts={counts} 
                                isOnline={isOnline}
                                onGoToCounting={() => {
                                    setActiveTab('worksheet');
                                    playChangeSound();
                                }}
                            />
                        </div>
                    )}

                    {/* Legacy notifications render deactivated */}
                    {activeTab === 'notifications' && false && (
                        <div className="space-y-4 animate-in fade-in duration-300 dir-rtl text-right">
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                                <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                                            <AlertCircle size={18} />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-sm text-slate-800 dark:text-white">مركز التنبيهات والإشعارات الميدانية</h3>
                                            <p className="text-[10px] text-slate-400 font-bold">تنبيهات فورية مبنية على حالة ورقة الجرد الفعلية والقرارات</p>
                                        </div>
                                    </div>
                                    <span className="px-2.5 py-1 bg-indigo-600 text-white text-[10px] font-black rounded-lg">تحديث حي ⚡</span>
                                </div>

                                <div className="mt-4 space-y-3">
                                    {/* Rejection Notification if any */}
                                    {audit.status === 'rejected' && (
                                        <div className="p-4 bg-rose-500/10 border border-rose-200 dark:border-rose-900/40 rounded-xl flex items-start gap-3">
                                            <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={18} />
                                            <div className="space-y-1">
                                                <h4 className="font-black text-rose-800 dark:text-rose-300 text-xs">⚠️ عاجل: تم رفض الجرد السابق بواسطة التاجر</h4>
                                                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-bold">
                                                    سبب الرفض: "{audit.rejectReason || 'توجد فروقات غير مبررة في الكميات الميدانية.'}"
                                                </p>
                                                <span className="text-[9px] text-rose-500 font-black block mt-1">💡 يرجى إعادة مراجعة الأصناف المطروحة وتسجيل أعدادها الفعلية بدقة.</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* High Discrepancy Notification */}
                                    {audit.items.some(item => {
                                        const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
                                        return counts[key] !== undefined && Math.abs(counts[key] - item.systemQty) >= 10;
                                    }) && (
                                        <div className="p-4 bg-amber-500/10 border border-amber-200 dark:border-amber-900/40 rounded-xl flex items-start gap-3">
                                            <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                                            <div className="space-y-1">
                                                <h4 className="font-black text-amber-800 dark:text-amber-300 text-xs">⚠️ رصد فروقات كمية حرجة (أكثر من 10 قطع)</h4>
                                                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                                                    تم الكشف عن تباين كبير بين الكمية الفعلية والدفترية في بعض الأصناف. يرجى مراجعة وتأكيد الكميات للأصناف التالية:
                                                </p>
                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                    {audit.items.filter(item => {
                                                        const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
                                                        return counts[key] !== undefined && Math.abs(counts[key] - item.systemQty) >= 10;
                                                    }).slice(0, 3).map(item => (
                                                        <span key={item.productId} className="px-2 py-0.5 bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] rounded font-bold">
                                                            {item.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Remaining uncounted alert */}
                                    {(audit.items.length - countedCount) > 0 ? (
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl flex items-start gap-3">
                                            <ClipboardList className="text-indigo-600 shrink-0 mt-0.5" size={18} />
                                            <div className="space-y-1">
                                                <h4 className="font-black text-slate-800 dark:text-white text-xs">📋 تذكير: متبقي {audit.items.length - countedCount} أصناف لم تُجرد</h4>
                                                <p className="text-[11px] text-slate-500 font-medium">
                                                    لم يتم عد أو تسجيل أي كميات لـ {audit.items.length - countedCount} صنف حتى الآن. يمكنك تصفية الأصناف من التبويب الرئيسي لإنهاء جردها بسرعة.
                                                </p>
                                                <button 
                                                    onClick={() => { setActiveTab('worksheet'); setFilterMode('uncounted'); }}
                                                    className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 underline block mt-1"
                                                >
                                                    انقر هنا لتصفية القائمة على الأصناف المتبقية فقط 🔍
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-emerald-500/10 border border-emerald-200 dark:border-emerald-900/40 rounded-xl flex items-start gap-3">
                                            <CheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={18} />
                                            <div className="space-y-1">
                                                <h4 className="font-black text-emerald-800 dark:text-emerald-300 text-xs">🎉 رائع! تم تغطية جرد جميع الأصناف بالكامل</h4>
                                                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                                                    تم جرد وحفظ 100% من السلع المدرجة بقطاع المستودع بنجاح. يمكنك الآن المضي قدماً وتسليم التوقيع والنتائج للإدارة.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* General tips cards */}
                                    <div className="p-4 bg-indigo-500/5 border border-indigo-100 dark:border-indigo-950/50 rounded-xl space-y-2">
                                        <h4 className="font-black text-indigo-700 dark:text-indigo-400 text-xs flex items-center gap-1">
                                            <Sparkles size={14} />
                                            نصائح الجرد الميداني السريع:
                                        </h4>
                                        <ul className="list-disc list-inside text-[11px] text-slate-500 dark:text-slate-400 font-medium space-y-1 pr-2">
                                            <li>استخدم <strong>وضع التركيز (Focus Mode)</strong> لقفل الكاميرا والاستمرار في مسح الباركود SKU تلو الآخر دون توقف.</li>
                                            <li>المساعد الصوتي يقوم بنطق اسم السلعة فور التعرف عليها لتقليل الاحتياج للنظر للشاشة.</li>
                                            <li>التقاط صور للبضائع التالفة أو التي تعاني من عجز يساعد التاجر المالي على قبول وتبرير العجز بسرعة.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sessions Tab */}
                    {activeTab === 'sessions' && (
                        <div className="space-y-6">
                            <SharedSupervisorFeatures 
                                audit={audit}
                                counts={counts}
                                onApprove={async (reason) => {
                                    await handleUpdateAuditStatus('approved');
                                }}
                                onReject={async (reason) => {
                                    await handleUpdateAuditStatus('rejected');
                                }}
                                collaboration={collaboration}
                            />
                        </div>
                    )}

                    {/* Reports Tab */}
                    {activeTab === 'reports' && (
                        <div className="space-y-6">
                            <SharedAuditReports 
                                audit={audit} 
                                counts={counts} 
                            />
                        </div>
                    )}
                        </div>
                    ) : (
                        (() => {
                            let totalSystemQty = 0;
                            let totalActualQty = 0;
                            let totalMissingQty = 0;
                            let totalExtraQty = 0;
                            let totalMissingItems = 0;
                            let totalExtraItems = 0;
                            let totalMatchedItems = 0;
                            
                            audit.items.forEach(item => {
                                totalSystemQty += item.systemQty;
                                const actual = item.actualQty ?? 0;
                                totalActualQty += actual;
                                
                                if (actual < item.systemQty) {
                                    totalMissingQty += (item.systemQty - actual);
                                    totalMissingItems++;
                                } else if (actual > item.systemQty) {
                                    totalExtraQty += (actual - item.systemQty);
                                    totalExtraItems++;
                                } else {
                                    totalMatchedItems++;
                                }
                            });
                            
                            const isPerfect = totalMissingItems === 0 && totalExtraItems === 0;

                            return (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                                    {/* Header Banner */}
                                    <div className={`relative overflow-hidden rounded-3xl p-8 sm:p-10 shadow-lg ${
                                        audit.status === 'approved' 
                                            ? 'bg-gradient-to-br from-emerald-600 to-emerald-900 text-white shadow-emerald-900/20' 
                                            : 'bg-gradient-to-br from-indigo-600 to-indigo-900 text-white shadow-indigo-900/20'
                                    }`}>
                                        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                                            {audit.status === 'approved' ? <FileCheck2 size={160} /> : <Clock size={160} />}
                                        </div>
                                        <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                                            <div className={`w-20 h-20 rounded-full flex items-center justify-center border-4 shadow-2xl ${
                                                audit.status === 'approved' 
                                                    ? 'bg-emerald-500 border-emerald-400/50 text-white shadow-emerald-900/50' 
                                                    : 'bg-indigo-500 border-indigo-400/50 text-white shadow-indigo-900/50'
                                            }`}>
                                                {audit.status === 'approved' ? <CheckCircle size={40} /> : <Clock size={40} className="animate-pulse" />}
                                            </div>
                                            <div className="space-y-4 max-w-2xl flex flex-col items-center">
                                                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 rounded-full text-xs font-black backdrop-blur-sm border border-white/20">
                                                    <ClipboardList size={14} />
                                                    {audit.title}
                                                    <span className="opacity-50 mx-1">•</span>
                                                    <MapPin size={14} />
                                                    {audit.warehouseName || 'المخزن الرئيسي'}
                                                </div>
                                                <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-2">
                                                    {audit.status === 'approved' ? 'تم اعتماد الجرد مالياً بنجاح!' : 'تم إرسال تقرير الجرد بنجاح'}
                                                </h2>
                                                <p className="text-sm sm:text-base font-medium opacity-90 leading-relaxed">
                                                    {audit.status === 'approved' 
                                                        ? 'قام التاجر المالي بمراجعة الجرد واعتماده، وتم تسوية وتحديث جميع الأرصدة في النظام بناءً على الحصر الميداني الخاص بك. شكراً لمجهودك!' 
                                                        : 'تم تسليم الجرد الخاص بك وهو الآن قيد المراجعة من قبل الإدارة أو التاجر المالي. سيتم إشعارك فور الاعتماد.'}
                                                </p>
                                            </div>
                                            <div className="inline-flex flex-wrap justify-center items-center gap-2 px-5 py-2.5 mt-2 bg-black/20 rounded-full text-xs font-bold backdrop-blur-md border border-white/10">
                                                <User size={14} />
                                                بواسطة: {audit.managerName || 'مسؤول مخزن'}
                                                <span className="opacity-50 mx-1">•</span>
                                                <Calendar size={14} />
                                                {audit.submittedAt ? new Date(audit.submittedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'غير محدد'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Results Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl">
                                                    <Boxes size={24} />
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">إجمالي الأصناف</span>
                                            </div>
                                            <div>
                                                <div className="text-3xl font-black text-slate-900 dark:text-white mb-1">{audit.items.length}</div>
                                                <div className="text-xs font-bold text-slate-500">صنف تم حصره ميدانياً</div>
                                            </div>
                                        </div>

                                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="p-3 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                                                    <Check size={24} />
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-lg">المتطابق</span>
                                            </div>
                                            <div>
                                                <div className="text-3xl font-black text-slate-900 dark:text-white mb-1">{totalMatchedItems}</div>
                                                <div className="text-xs font-bold text-slate-500">صنف سليم وبدون أي فروقات</div>
                                            </div>
                                        </div>

                                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="p-3 bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-2xl">
                                                    <TrendingDown size={24} />
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-2 py-1 rounded-lg">عجز (نواقص)</span>
                                            </div>
                                            <div>
                                                <div className="text-3xl font-black text-slate-900 dark:text-white mb-1">{totalMissingItems}</div>
                                                <div className="text-xs font-bold text-slate-500">إجمالي <span className="text-rose-600 dark:text-rose-400 font-black">{totalMissingQty}</span> قطعة ناقصة عن النظام</div>
                                            </div>
                                        </div>

                                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="p-3 bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-2xl">
                                                    <TrendingUp size={24} />
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg">زيادة (فائض)</span>
                                            </div>
                                            <div>
                                                <div className="text-3xl font-black text-slate-900 dark:text-white mb-1">{totalExtraItems}</div>
                                                <div className="text-xs font-bold text-slate-500">إجمالي <span className="text-blue-600 dark:text-blue-400 font-black">{totalExtraQty}</span> قطعة زيادة عن النظام</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Perfect Audit Banner */}
                                    {isPerfect && (
                                        <div className="bg-gradient-to-r from-amber-200 to-amber-400 dark:from-amber-700 dark:to-amber-900 rounded-3xl p-1 shadow-lg transform hover:scale-[1.01] transition-transform">
                                            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-[1.4rem] p-6 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-right">
                                                <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center text-white shadow-lg shrink-0">
                                                    <Sparkles size={32} />
                                                </div>
                                                <div className="flex-1 space-y-2">
                                                    <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center justify-center sm:justify-start gap-2">
                                                        جرد أسطوري ومطابق 100% <span className="text-2xl">🏆</span>
                                                    </h3>
                                                    <p className="text-sm text-slate-600 dark:text-slate-300 font-bold leading-relaxed">
                                                        عاش جداً! لم يتم تسجيل أي حالة عجز أو زيادة في هذا الجرد. كل الأرصدة الميدانية مطابقة تماماً لأرصدة النظام. عمل ممتاز من مسؤول المخزن.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Manager Info & Notes */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
                                            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                                                <Fingerprint className="text-indigo-500" size={24} />
                                                <h3 className="text-base font-black text-slate-800 dark:text-white">توثيق الجلسة المعتمد</h3>
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <p className="text-[10px] uppercase font-black text-slate-400 mb-1">اسم المسؤول (المُقر)</p>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{audit.managerName}</p>
                                                </div>
                                                {audit.signatureData && (
                                                    <div>
                                                        <p className="text-[10px] uppercase font-black text-slate-400 mb-2">التوقيع الإلكتروني</p>
                                                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 flex justify-center">
                                                            <img src={audit.signatureData} alt="Manager Signature" className="h-16 object-contain opacity-80" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
                                            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                                                <FileText className="text-slate-500" size={24} />
                                                <h3 className="text-base font-black text-slate-800 dark:text-white">ملاحظات المستودع</h3>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 h-full min-h-[120px]">
                                                {audit.notes ? (
                                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                                        {audit.notes}
                                                    </p>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                                                        <FileText size={32} className="opacity-20" />
                                                        <p className="text-xs font-bold">لا توجد ملاحظات عامة مرفقة مع هذا الجرد</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                </div>
                            );
                        })()
                    )}
                </div>

                {/* Custom Confirm Dialog Modal */}
                {confirmDialog?.isOpen && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200 text-right">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${
                                    confirmDialog.type === 'danger' ? 'bg-rose-50 text-rose-500 dark:bg-rose-950/20' :
                                    confirmDialog.type === 'success' ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/20' :
                                    confirmDialog.type === 'info' ? 'bg-blue-50 text-blue-500 dark:bg-blue-950/20' :
                                    'bg-amber-50 text-amber-500 dark:bg-amber-950/20'
                                }`}>
                                    <AlertCircle size={24} />
                                </div>
                                <h4 className="text-base font-black text-slate-850 dark:text-white">
                                    {confirmDialog.title}
                                </h4>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 font-bold leading-relaxed">
                                {confirmDialog.message}
                            </p>
                            <div className="flex justify-end gap-3 mt-2">
                                <button
                                    onClick={() => setConfirmDialog(null)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
                                >
                                    إلغاء
                                </button>
                                <button
                                    onClick={async () => {
                                        const callback = confirmDialog.onConfirm;
                                        setConfirmDialog(null);
                                        await callback();
                                    }}
                                    className={`px-5 py-2 rounded-xl text-xs font-black text-white shadow-sm transition-all ${
                                        confirmDialog.type === 'danger' ? 'bg-rose-650 hover:bg-rose-700' :
                                        confirmDialog.type === 'success' ? 'bg-emerald-650 hover:bg-emerald-700' :
                                        confirmDialog.type === 'info' ? 'bg-blue-650 hover:bg-blue-700' :
                                        'bg-indigo-650 hover:bg-indigo-700'
                                    }`}
                                >
                                    تأكيد العمل
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Custom Alert Dialog Modal */}
                {alertDialog?.isOpen && (
                    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200 text-right">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${
                                    alertDialog.type === 'danger' ? 'bg-rose-50 text-rose-500 dark:bg-rose-950/20' :
                                    alertDialog.type === 'success' ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/20' :
                                    alertDialog.type === 'warning' ? 'bg-amber-50 text-amber-500 dark:bg-amber-950/20' :
                                    'bg-blue-50 text-blue-500 dark:bg-blue-950/20'
                                }`}>
                                    <CheckCircle2 size={24} />
                                </div>
                                <h4 className="text-base font-black text-slate-850 dark:text-white">
                                    {alertDialog.title}
                                </h4>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 font-bold leading-relaxed">
                                {alertDialog.message}
                            </p>
                            <div className="flex justify-end gap-3 mt-2">
                                <button
                                    onClick={() => setAlertDialog(null)}
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs shadow-md transition-all"
                                >
                                    حسناً
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Full Image Viewer Modal */}
                {fullImageView && (
                    <div 
                        className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300"
                        onClick={() => setFullImageView(null)}
                    >
                        <div className="relative max-w-4xl w-full flex flex-col items-center gap-4 animate-in zoom-in-95 duration-300">
                            <img 
                                src={fullImageView} 
                                className="max-w-full max-h-[85vh] rounded-3xl shadow-2xl border-2 border-white/10" 
                                onClick={(e) => e.stopPropagation()}
                            />
                            <button
                                onClick={() => setFullImageView(null)}
                                className="px-8 py-3 bg-white text-slate-900 font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all"
                            >
                                إغلاق الصورة
                            </button>
                        </div>
                    </div>
                )}

                {/* Interactive Onboarding Tour (Floating Tooltips) */}
                <AnimatePresence>
                    {showTutorial && (
                        <div className="fixed inset-0 z-[500] pointer-events-none">
                            {/* Simple Backdrop without blur */}
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-slate-950/20"
                            />

                            {/* Glowing Highlight Ring */}
                            {tutorialStep > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 1.2 }}
                                    animate={{ 
                                        opacity: 1, 
                                        scale: 1,
                                        ...(() => {
                                            const ids = [
                                                'passcode-input',         // 1
                                                'manager-name-input',     // 2
                                                'signature-pad-container',// 3
                                                'unlock-session-btn',     // 4
                                                'inventory-summary-card', // 5
                                                'scanner-button',         // 6
                                                'first-product-item',     // 7
                                                'final-submit-section'    // 8
                                            ];
                                            const targetId = ids[tutorialStep - 1];
                                            const el = targetId ? document.getElementById(targetId) : null;
                                            if (!el) return { display: 'none' };
                                            const rect = el.getBoundingClientRect();
                                            const padding = 4;
                                            return {
                                                top: rect.top - padding,
                                                left: rect.left - padding,
                                                width: rect.width + (padding * 2),
                                                height: rect.height + (padding * 2),
                                            };
                                        })()
                                    }}
                                    className="absolute border-4 border-indigo-500 rounded-xl shadow-[0_0_30px_rgba(99,102,241,0.6)] z-[501]"
                                />
                            )}

                            {/* Floating Guidance Card */}
                            <div className="absolute inset-0 flex items-end justify-center sm:items-center p-6 pb-12 sm:pb-6">
                                <motion.div 
                                    key={tutorialStep}
                                    initial={{ opacity: 0, y: 50, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                                    className="bg-white dark:bg-slate-900 rounded-[1.5rem] p-5 shadow-2xl max-w-sm w-full pointer-events-auto border-2 border-indigo-500/20 dark:border-indigo-400/20 text-right relative z-[502]"
                                    dir="rtl"
                                >
                                    {tutorialStep === 0 ? (
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shrink-0">
                                                    <Zap size={24} className="animate-pulse" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-black text-slate-800 dark:text-white">دليل وشرح طريقة الجرد والدخول</h3>
                                                    <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-black">شرح خطوة بخطوة من قبل الدخول حتى تسليم التقرير</p>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-600 dark:text-slate-300 font-bold leading-relaxed">
                                                أهلاً بك! سنشرح لك أولاً **طريقة الدخول وتوثيق هويتك قبل البدء** عبر (رمز المرور، اسمك الثلاثي، وتوقيعك الرقمي)، ثم طريقة حصر البضائع والباركود والمتبقي (ناقص إيه).
                                            </p>
                                            <div className="flex flex-col gap-2">
                                                <button 
                                                    onClick={() => {
                                                        setTutorialStep(1);
                                                        speak("الخطوة الأولى: أدخل رمز المرور المعتمد من التاجر للتحقق من صلاحية الجلسة");
                                                    }}
                                                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-sm shadow-lg shadow-indigo-600/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <span>بدء شرح خطوات الدخول والجرد 🚀</span>
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        setShowTutorial(false);
                                                        localStorage.setItem('tutorial_disabled_permanently', 'true');
                                                        localStorage.setItem(`tutorial_seen_${auditId}`, 'true');
                                                    }}
                                                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 font-black text-[11px] rounded-xl transition-all"
                                                >
                                                    🚫 إخفاء الشرح نهائياً (حتى لو أعدت تحميل الصفحة)
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-1">
                                                    <div className="inline-block px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-[10px] font-black rounded-md mb-1">
                                                        {tutorialStep <= 4 ? '🔒 مرحلة ما قبل الدخول وتوثيق الجلسة' : '📦 مرحلة العد والجرد الميداني'}
                                                    </div>
                                                    <h4 className="text-md font-black text-slate-900 dark:text-white">
                                                        {tutorialStep === 1 && '1️⃣ رمز المرور المعتمد (4 أرقام)'}
                                                        {tutorialStep === 2 && '2️⃣ اسم مسؤول المخزن الميداني'}
                                                        {tutorialStep === 3 && '3️⃣ التوقيع الرقمي المعتمد'}
                                                        {tutorialStep === 4 && '4️⃣ فتح الجلسة وبدء العد'}
                                                        {tutorialStep === 5 && '5️⃣ متابعة نتائج الجرد المباشرة (ناقص إيه)'}
                                                        {tutorialStep === 6 && '6️⃣ البحث باسم الصنف أو مسح الباركود'}
                                                        {tutorialStep === 7 && '7️⃣ تسجيل العدد الفعلي وتأكيده'}
                                                        {tutorialStep === 8 && '8️⃣ تسليم تقرير الجرد النهائي'}
                                                    </h4>
                                                    <p className="text-xs text-slate-700 dark:text-slate-300 font-bold leading-relaxed">
                                                        {tutorialStep === 1 && 'أول خطوة قبل الدخول: أدخل رمز الأمان المكون من 4 أرقام الممنوح لك من التاجر.'}
                                                        {tutorialStep === 2 && 'ثاني خطوة: اكتب اسمك الثلاثي بالكامل كمسؤول عن الحصر الميداني لربط التقرير بهويتك.'}
                                                        {tutorialStep === 3 && 'ثالث خطوة: ضع توقيعك الإلكتروني بإصبعك أو الماوس داخل المربع المخصص لإقرار صحة البيانات.'}
                                                        {tutorialStep === 4 && 'رابع خطوة: اضغط زر "فتح الجلسة وبدء العد" للانتقال المباشر لكشف الأصناف وحصر البضائع.'}
                                                        {tutorialStep === 5 && 'خامس خطوة: لوحة تفاعلية تظهر لك الإجمالي، المجرود، والأصناف المتبقية (ناقص إيه) لمتابعة الإنجاز.'}
                                                        {tutorialStep === 6 && 'سادس خطوة: استخدم كاميرا الموبايل لمسح باركود المنتجات أو ابحث باسم المنتج للوصول له ثوانٍ.'}
                                                        {tutorialStep === 7 && 'سابع خطوة: اكتب عدد القطع الموجودة فعلياً على الرف، ثم اضغط علامة الصح الخضراء لحفظ الصنف.'}
                                                        {tutorialStep === 8 && 'آخر خطوة: بعد التأكد من جرد جميع الأصناف، اضغط زر "تسليم الجرد" لإرسال التقرير نهائياً للتاجر.'}
                                                    </p>
                                                </div>
                                                <button 
                                                    onClick={() => {
                                                        setShowTutorial(false);
                                                        localStorage.setItem(`tutorial_seen_${auditId}`, 'true');
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0"
                                                    title="إغلاق الشرح"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>

                                            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 gap-2">
                                                <div className="text-[10px] text-slate-400 font-black shrink-0">
                                                    الخطوة {tutorialStep} من 8
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {tutorialStep > 1 && (
                                                        <button 
                                                            type="button"
                                                            onClick={() => setTutorialStep(tutorialStep - 1)}
                                                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-black text-xs hover:bg-slate-200 transition-all flex items-center gap-1"
                                                        >
                                                            <ChevronRight size={14} /> السابق
                                                        </button>
                                                    )}

                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            if (tutorialStep === 8) {
                                                                setShowTutorial(false);
                                                                localStorage.setItem(`tutorial_seen_${auditId}`, 'true');
                                                            } else {
                                                                setTutorialStep(tutorialStep + 1);
                                                            }
                                                        }}
                                                        className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-md shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-1"
                                                    >
                                                        {tutorialStep === 8 ? 'تم والبدء' : 'التالي'} <ChevronLeft size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            </div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    return null;
}
