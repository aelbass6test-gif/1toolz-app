import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseClient';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { 
    ClipboardList, CheckCircle2, AlertCircle, Search, Save, Package, 
    Lock, ArrowLeft, Info, HelpCircle, Loader2, RefreshCw, User, FileText, 
    ChevronRight, PenTool, RotateCcw, Sparkles, Filter, AlertTriangle,
    Camera, Mic, Zap, Target, Volume2, VolumeX, MapPin, XCircle, Trash2,
    Fingerprint, X, ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { audioSynth } from '../utils/audioSynth';
import confetti from 'canvas-confetti';
import { Html5Qrcode } from 'html5-qrcode';

interface SharedAuditItem {
    productId: string;
    variantId?: string;
    name: string;
    sku: string;
    systemQty: number;
    actualQty?: number;
    notes?: string;
}

interface SharedAudit {
    id: string;
    storeId: string;
    title: string;
    warehouseId: string;
    warehouseName?: string;
    scope: string;
    status: 'pending' | 'submitted' | 'approved' | 'rejected';
    createdAt: string;
    submittedAt?: string;
    rejectedAt?: string;
    passcode?: string;
    managerName?: string;
    rejectReason?: string;
    signatureData?: string;
    isBlindCount?: boolean;
    items: SharedAuditItem[];
    notes?: string;
}

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
    const [searchQuery, setSearchQuery] = useState('');
    const [filterMode, setFilterMode] = useState<'all' | 'discrepancy' | 'uncounted'>('all');

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
        } else {
            audioSynth.playTone('error');
            triggerHaptic();
            speak('الصنف ده مش موجود في كشف الجرد');
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
                
                // Initialize form values from loaded data
                setManagerName(data.managerName || '');
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
                
                setCounts(initialCounts);
                setItemNotes(initialNotes);

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
        
        // Check for biometric support
        if (window.PublicKeyCredential && 
            window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
            window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(result => {
                setIsBiometricSupported(result);
            });
        }

        // Check if user has seen tutorial
        const hasSeen = localStorage.getItem(`tutorial_seen_${auditId}`);
        if (!hasSeen) {
            setShowTutorial(true);
        }
    }, [auditId]);

    // Auto-advance tutorial based on real actions
    useEffect(() => {
        if (!showTutorial) return;

        if (tutorialStep === 1 && passcode.length === 4) {
            setTutorialStep(2);
            speak("عاش يا بطل، دلوقت اضغط على زرار فتح الجلسة عشان ندخل");
        }
        if (tutorialStep === 2 && isUnlocked) {
            setTutorialStep(3);
            speak("منور، اكتب اسمك ووقع في المربع ده عشان نبدأ نعد");
        }
        if (tutorialStep === 3 && isIdentified) {
            setTutorialStep(4);
            speak("تمام جداً، اضغط بقى على زرار بدأ الجرد عشان نشوف الأصناف");
        }
        if (tutorialStep === 4 && isFocusMode) {
             setTutorialStep(5);
             speak("هنا تقدر تستخدم الكاميرا لو حابب تمسح باركود الصنف بسرعة");
        }
    }, [passcode, isUnlocked, isIdentified, isFocusMode, tutorialStep, showTutorial, auditId]);

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

    // Handle unlocking via passcode
    const handleUnlock = (e: React.FormEvent) => {
        e.preventDefault();
        if (audit && passcode === audit.passcode) {
            setIsUnlocked(true);
            setPasscodeError(false);
            audioSynth.playTone('success');
        } else {
            setPasscodeError(true);
            audioSynth.playTone('error');
            setTimeout(() => setPasscodeError(false), 500);
        }
    };

    // Persistence: Save/Load counts from localStorage
    useEffect(() => {
        if (!auditId) return;
        try {
            const saved = localStorage.getItem(`audit_draft_${auditId}`);
            if (saved) {
                const parsed = JSON.parse(saved);
                setCounts(prev => ({ ...prev, ...parsed }));
            }
        } catch (e) {
            console.warn("LocalStorage access failed: ", e);
        }
    }, [auditId]);

    useEffect(() => {
        if (!auditId || Object.keys(counts).length === 0) return;
        try {
            localStorage.setItem(`audit_draft_${auditId}`, JSON.stringify(counts));
        } catch (e) {
            console.warn("LocalStorage saving failed: ", e);
        }
    }, [counts, auditId]);

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
            const key = `${item.sku}_${item.name}`;
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

    // Passcode Lock Screen View
    if (!isUnlocked && audit) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 dir-rtl">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm max-w-md w-full text-center space-y-6">
                    <div className="mx-auto w-16 h-16 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shadow-inner">
                        <Lock size={30} />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-xl font-black text-slate-800 dark:text-white">رمز حماية الجلسة</h2>
                        <p className="text-xs text-slate-400 font-medium">هذه الجلسة محمية برمز مرور. يرجى إدخال الرمز المرسل إليك من التاجر للدخول.</p>
                        <button 
                            onClick={() => { setShowTutorial(true); setTutorialStep(0); }}
                            className="mt-2 text-indigo-600 dark:text-indigo-400 text-[10px] font-black underline underline-offset-4 flex items-center gap-1 mx-auto hover:text-indigo-700 transition-colors"
                        >
                            <HelpCircle size={12} /> مش عارف تعمل إيه؟ اضغط هنا للشرح
                        </button>
                    </div>

                    <form onSubmit={handleUnlock} className="space-y-4">
                        <input 
                            id="passcode-input"
                            type="password"
                            required
                            value={passcode}
                            onChange={e => setPasscode(e.target.value)}
                            placeholder="أدخل رمز المرور المكون من 4 أرقام"
                            className={`w-full p-4 text-center bg-slate-50 dark:bg-slate-800 border rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-lg font-black tracking-widest dark:text-white transition-all ${passcodeError ? 'border-red-500 ring-4 ring-red-500/15' : 'border-slate-200 dark:border-slate-700'}`}
                        />
                        {passcodeError && (
                            <p className="text-rose-500 text-xs font-bold animate-shake">رمز المرور غير صحيح، يرجى المحاولة مجدداً</p>
                        )}
                        
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button 
                                id="unlock-session-btn"
                                type="submit" 
                                className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-black shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.98] transition-all"
                            >
                                فتح الجلسة
                            </button>

                            {isBiometricSupported && (
                                <button 
                                    type="button"
                                    onClick={handleBiometricAuth}
                                    className="p-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-black hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700"
                                    title="الدخول بالبصمة أو الوجه"
                                >
                                    <Fingerprint size={20} className="text-indigo-600" />
                                    <span>بصمة</span>
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    // Identification Screen (Name & Signature mandatory before counting)
    if (isUnlocked && !isIdentified && audit && (audit.status === 'pending' || audit.status === 'rejected')) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 dir-rtl">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl max-w-lg w-full space-y-6 animate-in fade-in zoom-in-95 duration-300 text-right" dir="rtl">
                    <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                            <User size={24} />
                        </div>
                        <div className="space-y-0.5">
                            <h2 className="text-xl font-black text-slate-800 dark:text-white">إقرار وبدء جرد ميداني</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">خطوة إجبارية لتحديد المسؤولية القانونية</p>
                            <button 
                                onClick={() => { setShowTutorial(true); setTutorialStep(3); }}
                                className="text-indigo-600 dark:text-indigo-400 text-[9px] font-black flex items-center gap-1 hover:underline"
                            >
                                <HelpCircle size={10} /> شرح الخطوة دي
                            </button>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/30 text-[11px] text-amber-700 dark:text-amber-400 flex gap-3">
                            <AlertCircle size={20} className="shrink-0" />
                            <p className="leading-relaxed font-bold">بموجب توقيعك أدناه، تقر بأنك ستقوم بعملية العد الفعلي بدقة للأصناف الموكلة إليك، وتتحمل مسؤولية مطابقة الكميات الميدانية مع نظام التاجر.</p>
                        </div>

                        <div>
                            <label className="text-xs text-slate-500 dark:text-slate-400 font-bold block mb-1.5">اسم مسؤول المخزن بالكامل *</label>
                            <input 
                                id="manager-name-input"
                                type="text"
                                required
                                value={managerName}
                                onChange={e => setManagerName(e.target.value)}
                                placeholder="يرجى كتابة الاسم الثلاثي"
                                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-bold dark:text-white transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                    <PenTool size={14} className="text-indigo-600" />
                                    التوقيع الرقمي المعتمد *
                                </label>
                                <button onClick={clearSignature} className="text-[10px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors">
                                    <RotateCcw size={12} /> مسح وإعادة الرسم
                                </button>
                            </div>
                            <div id="signature-pad-container" className="relative border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 overflow-hidden touch-none">
                                <canvas
                                    ref={canvasRef}
                                    width={500}
                                    height={140}
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
                                    className="w-full h-36 cursor-crosshair block"
                                />
                                {!hasSigned && (
                                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 text-xs font-black gap-2">
                                        <Zap size={20} className="opacity-20" />
                                        <span>وقع بإصبعك هنا للمتابعة</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button 
                            id="start-counting-btn"
                            onClick={async () => {
                                if (!managerName.trim() || !hasSigned) {
                                    audioSynth.playTone('error');
                                    customAlert('بيانات ناقصة', 'يا بطل، لازم تكتب اسمك وتوقع عشان نقدر نفتحلك قائمة الأصناف ونبدأ الجرد.', 'warning');
                                    return;
                                }

                                // Capture signature before switching screens
                                if (canvasRef.current) {
                                    const signatureData = canvasRef.current.toDataURL('image/png');
                                    setManagerSignature(signatureData);
                                }

                                if (isBiometricSupported) {
                                    // Optional but recommended biometric verification on start
                                    try {
                                        await handleBiometricVerifyIdentity();
                                    } catch (e) {
                                        console.warn("Biometric verification skipped or failed during identification step");
                                    }
                                }

                                setIsIdentified(true);
                                audioSynth.playTone('success');
                                speak('تمام يا وحش، تقدر تبدأ الجرد دلوقتي وتعد الأصناف بدقة.');
                            }}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-black shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
                        >
                            فتح قائمة الأصناف وبدء العد
                            <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
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

                <div className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
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
                        <div className="bg-rose-500/10 border-2 border-rose-500/30 dark:border-rose-500/20 rounded-2xl p-5 shadow-lg space-y-3 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
                                <div className="p-2 bg-rose-100 dark:bg-rose-950/50 rounded-xl shrink-0">
                                    <AlertTriangle size={24} />
                                </div>
                                <div>
                                    <h3 className="font-black text-sm">تم رفض تسليم الجرد السابق بواسطة إدارة التاجر</h3>
                                    <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                                        يرجى الاطلاع على الملاحظات أدناه والتأكد من إعادة الحصر الفعلي ثم إعادة التسليم والتوقيع.
                                    </p>
                                </div>
                            </div>
                            
                            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-rose-200/80 dark:border-rose-950/60 shadow-inner space-y-1">
                                <span className="text-[11px] text-rose-500 dark:text-rose-400 font-extrabold block">
                                    سبب الرفض وملاحظات التاجر المالي:
                                </span>
                                <p className="text-xs font-black text-slate-800 dark:text-rose-100 leading-relaxed">
                                    "{audit.rejectReason || 'توجد فروقات غير مبررة، يرجى إعادة العد الدقيق بالقطعة وتأكيد الكميات.'}"
                                </p>
                            </div>
                        </div>
                    )}

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
                                        className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-white text-indigo-600 rounded-2xl font-black text-sm shadow-md hover:scale-[1.02] active:scale-95 transition-all"
                                    >
                                        <Camera size={20}/>
                                        فتح الكاميرا
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

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

                    {/* Manager Name & Signature Section */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
                        <h3 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <User size={16} className="text-indigo-600" />
                            بيانات وإقرار وتوقيع مسؤول المخزن القائم بالجرد
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-slate-500 dark:text-slate-400 font-bold block mb-1">اسم مسؤول المخزن (القائم بعملية العد الميداني) *</label>
                                <input 
                                    type="text"
                                    required
                                    disabled={!isEditable}
                                    value={managerName}
                                    onChange={e => setManagerName(e.target.value)}
                                    placeholder="يرجى كتابة الاسم الثلاثي بالكامل"
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-bold dark:text-white disabled:opacity-75 disabled:bg-slate-100 dark:disabled:bg-slate-900"
                                />
                            </div>

                            <div>
                                <label className="text-xs text-slate-500 dark:text-slate-400 font-bold block mb-1">ملاحظات عامة حول عملية جرد هذا اليوم (اختياري)</label>
                                <input 
                                    type="text"
                                    disabled={!isEditable}
                                    value={managerNotes}
                                    onChange={e => setManagerNotes(e.target.value)}
                                    placeholder="أية ملاحظات عامة حول البضائع، الترتيب أو حالة الأرفف"
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-bold dark:text-white disabled:opacity-75 disabled:bg-slate-100 dark:disabled:bg-slate-900"
                                />
                            </div>
                        </div>

                        {/* Interactive Digital Signature Pad */}
                        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <PenTool size={14} className="text-indigo-600" />
                                    الإمضاء والتوقيع الرقمي الموثق لمسؤول الجرد *
                                </label>
                                {isEditable && (
                                    <button
                                        type="button"
                                        onClick={clearSignature}
                                        className="text-[11px] font-bold text-slate-400 hover:text-rose-500 transition-all flex items-center gap-1"
                                    >
                                        <RotateCcw size={12} />
                                        مسح التوقيع وإعادة الرسم
                                    </button>
                                )}
                            </div>

                            {isEditable ? (
                                <div className="relative border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 overflow-hidden touch-none">
                                    <canvas
                                        ref={canvasRef}
                                        width={600}
                                        height={140}
                                        onMouseDown={startDrawing}
                                        onMouseMove={draw}
                                        onMouseUp={stopDrawing}
                                        onMouseLeave={stopDrawing}
                                        onTouchStart={startDrawing}
                                        onTouchMove={draw}
                                        onTouchEnd={stopDrawing}
                                        className="w-full h-36 cursor-crosshair block"
                                    />
                                    {!hasSigned && !audit.signatureData && (
                                        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400 text-xs font-bold gap-1">
                                            <PenTool size={20} className="opacity-40" />
                                            <span>وقع بإصبعك أو الماوس هنا لإقرار صحة الكميات</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                audit.signatureData ? (
                                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-500">التوقيع المسجل للجلسة:</span>
                                        <img src={audit.signatureData} alt="التوقيع الرقمي" className="h-14 max-w-[200px] object-contain bg-white rounded-lg p-1 border" />
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400 font-bold italic">لم يتم إرفاق توقيع لهذه الجلسة.</p>
                                )
                            )}
                        </div>
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
                                                            type="number"
                                                            min="0"
                                                            disabled={!isEditable}
                                                            value={countValue}
                                                            onChange={e => {
                                                                const val = e.target.value === '' ? 0 : Math.max(0, Number(e.target.value));
                                                                setCounts(prev => ({ ...prev, [key]: val }));
                                                            }}
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
                                                        
                                                        {/* Manual Confirm Button */}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (counts[key] === undefined) {
                                                                    setCounts(prev => ({ ...prev, [key]: 0 }));
                                                                }
                                                                audioSynth.playTone('success');
                                                            }}
                                                            className={`p-3 rounded-2xl transition-all shadow-sm flex items-center justify-center ${
                                                                counts[key] !== undefined 
                                                                    ? 'bg-emerald-600 text-white shadow-emerald-500/20' 
                                                                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-600'
                                                            }`}
                                                            title={counts[key] !== undefined ? 'تم جرد هذا الصنف' : 'تأكيد جرد هذا الصنف (حتى لو صفر)'}
                                                        >
                                                            <CheckCircle2 size={18} />
                                                        </button>
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
                    {isEditable ? (
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
                    ) : (
                        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-950/40 rounded-2xl p-6 text-center space-y-3">
                            <div className="mx-auto w-10 h-10 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center">
                                <CheckCircle2 size={20} />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-black text-emerald-800 dark:text-emerald-400 text-sm">تم تسليم وحفظ هذا التقرير وتوقيعه</h3>
                                <p className="text-xs text-emerald-600 dark:text-emerald-500/80 max-w-md mx-auto">
                                    قام المستودع بتسليم عملية الجرد بنجاح في {audit.submittedAt ? new Date(audit.submittedAt).toLocaleDateString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : ''} بواسطة القائم بالجرد: <strong>{audit.managerName}</strong>. وهي الآن قيد المراجعة والاعتماد المالي لدى التاجر.
                                </p>
                            </div>
                        </div>
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

                {/* Onboarding Tour Overlay */}
                <AnimatePresence>
                    {showTutorial && (
                        <div className="fixed inset-0 z-[500] pointer-events-none overflow-hidden">
                            {/* Backdrop with hole */}
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm pointer-events-auto"
                                style={{
                                    clipPath: (() => {
                                        const ids = ['passcode-input', 'unlock-session-btn', 'manager-name-input', 'signature-pad-container', 'start-counting-btn', 'scanner-button', 'first-product-item', 'final-submit-section'];
                                        const targetId = ids[tutorialStep - 1];
                                        const el = targetId ? document.getElementById(targetId) : null;
                                        if (!el || tutorialStep === 0) return 'none';
                                        const rect = el.getBoundingClientRect();
                                        const padding = 10;
                                        return `polygon(0% 0%, 0% 100%, ${rect.left - padding}px 100%, ${rect.left - padding}px ${rect.top - padding}px, ${rect.right + padding}px ${rect.top - padding}px, ${rect.right + padding}px ${rect.bottom + padding}px, ${rect.left - padding}px ${rect.bottom + padding}px, ${rect.left - padding}px 100%, 100% 100%, 100% 0%)`;
                                    })()
                                }}
                            />

                            {/* Tutorial Content */}
                            <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
                                <motion.div 
                                    key={tutorialStep}
                                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -20, scale: 0.9 }}
                                    className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl max-w-md w-full pointer-events-auto border border-slate-200 dark:border-slate-800 text-right"
                                    dir="rtl"
                                >
                                    {tutorialStep === 0 ? (
                                        <div className="space-y-6">
                                            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner">
                                                <Zap size={40} className="animate-pulse" />
                                            </div>
                                            <div className="text-center space-y-2">
                                                <h3 className="text-2xl font-black text-slate-800 dark:text-white">أهلاً بك في نظام الجرد الذكي</h3>
                                                <p className="text-sm text-slate-500 font-bold leading-relaxed">يسعدنا انضمامك! لنأخذ جولة سريعة لنعرفك على خطوات الجرد الصحيحة لضمان دقة بيانات مخزنك.</p>
                                            </div>
                                            <div className="flex flex-col gap-3 pt-2">
                                                <button 
                                                    onClick={() => setTutorialStep(1)}
                                                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/20 hover:scale-[1.02] active:scale-95 transition-all"
                                                >
                                                    ابدأ الجولة التعليمية
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        setShowTutorial(false);
                                                        localStorage.setItem(`tutorial_seen_${auditId}`, 'true');
                                                    }}
                                                    className="w-full py-3 text-slate-400 font-bold text-xs hover:text-slate-600 transition-colors"
                                                >
                                                    تخطي الشرح، أنا أعرف النظام
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            <div className="flex justify-between items-center">
                                                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full text-[10px] font-black uppercase tracking-widest">خطوة {tutorialStep} من 7</span>
                                                <button 
                                                    onClick={() => {
                                                        setShowTutorial(false);
                                                        localStorage.setItem(`tutorial_seen_${auditId}`, 'true');
                                                    }}
                                                    className="text-slate-300 hover:text-rose-500 transition-colors"
                                                >
                                                    <X size={20} />
                                                </button>
                                            </div>

                                            <div className="space-y-2">
                                                <h4 className="text-lg font-black text-indigo-600">
                                                    {tutorialStep === 1 && '1. أدخل رمز الأمان'}
                                                    {tutorialStep === 2 && '2. افتح الجلسة'}
                                                    {tutorialStep === 3 && '3. إثبات الشخصية'}
                                                    {tutorialStep === 4 && '4. ابدأ الجرد'}
                                                    {tutorialStep === 5 && '5. استخدم الباركود'}
                                                    {tutorialStep === 6 && '6. سجل الكميات'}
                                                    {tutorialStep === 7 && '7. تسليم التقرير'}
                                                </h4>
                                                <p className="text-sm text-slate-600 dark:text-slate-400 font-bold leading-relaxed">
                                                    {tutorialStep === 1 && 'من فضلك اكتب الـ 4 أرقام اللي التاجر بعتهم لك هنا.'}
                                                    {tutorialStep === 2 && 'ممتاز، دلوقتي اضغط على "فتح الجلسة" عشان نتأكد من الرمز.'}
                                                    {tutorialStep === 3 && 'اكتب اسمك ووقع في المربع، ده مهم جداً عشان التاجر يعرف مين اللي جرد.'}
                                                    {tutorialStep === 4 && 'اضغط "بدأ الجرد" عشان نفتح لك لستة الأصناف.'}
                                                    {tutorialStep === 5 && 'لو المنتج قدامك عليه باركود، دوس هنا وصوره وهيطلع لك فوراً.'}
                                                    {tutorialStep === 6 && 'عد اللي على الرف واكتبه هنا، ودوس "صح" عشان الصنف يتحفظ.'}
                                                    {tutorialStep === 7 && 'خلصت؟ دوس "تسليم الجرد" وكده مهمتك انتهت بنجاح!'}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-3 pt-4">
                                                {/* Hide Next button for steps that require action, or allow it as skip */}
                                                <button 
                                                    onClick={() => {
                                                        if (tutorialStep === 7) {
                                                            setShowTutorial(false);
                                                            localStorage.setItem(`tutorial_seen_${auditId}`, 'true');
                                                        } else {
                                                            setTutorialStep(tutorialStep + 1);
                                                        }
                                                    }}
                                                    className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                                                >
                                                    {tutorialStep === 7 ? 'فهمت كل شيء، لنبدأ!' : 'تخطي للخطوة التالية'}
                                                    <ChevronLeft size={18} />
                                                </button>
                                                {tutorialStep > 1 && (
                                                    <button 
                                                        onClick={() => setTutorialStep(tutorialStep - 1)}
                                                        className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl hover:bg-slate-200 transition-all"
                                                    >
                                                        <RotateCcw size={18} />
                                                    </button>
                                                )}
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
