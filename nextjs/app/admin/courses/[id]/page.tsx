"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import API, { resolveAssetUrl } from "@/services/api";
import styles from "./page.module.css";

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayHandlerResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: RazorpayHandlerResponse) => void;
}

interface RazorpayInstance {
  open: () => void;
  on: (eventName: string, callback: (response: unknown) => void) => void;
}

interface CourseLesson {
  title?: string | null;
  videoUrl?: string | null;
  pdfUrl?: string | null;
  quizTitle?: string | null;
  assignmentTitle?: string | null;
}

interface CourseModule {
  title?: string | null;
  lessons?: CourseLesson[];
}

interface CourseDetails {
  _id: string;
  title: string;
  description?: string | null;
  duration?: string | null;
  fee?: number;
  category?: string | null;
  meetingLink?: string | null;
  level?: string | null;
  trainerId?: {
    _id?: string;
    name?: string;
    email?: string;
    specialization?: string;
  } | null;
  startDate?: string | null;
  endDate?: string | null;
  maxEnrolments?: number | null;
  isActive?: boolean;
  enrolmentCount?: number;
  videoUrl?: string | null;
  pdfUrl?: string | null;
  thumbnailUrl?: string | null;
  modules?: CourseModule[];
  createdAt?: string;
}

interface EnrolmentRow {
  _id: string;
  status: string;
  progress: number;
  createdAt?: string;
  studentId?: {
    _id?: string;
    name?: string;
    email?: string;
  } | null;
}

type ReactionType = "like" | "dislike" | null;
type CourseTab = "overview" | "curriculum" | "video" | "resources" | "reviews";
type MessageTone = "neutral" | "success" | "error";

interface VideoComment {
  _id: string;
  comment: string;
  createdAt: string;
  isMine?: boolean;
  studentId?: {
    _id?: string;
    name?: string;
  } | null;
}

interface VideoEngagementData {
  summary: {
    likes: number;
    dislikes: number;
    ratingAverage: number;
    ratingCount: number;
    commentsCount: number;
  };
  myFeedback: {
    reaction: ReactionType;
    rating: number | null;
  };
  canInteract: boolean;
  isEnrolled: boolean;
  studentProfileId?: string | null;
  comments: VideoComment[];
}

const emptyEngagement: VideoEngagementData = {
  summary: {
    likes: 0,
    dislikes: 0,
    ratingAverage: 0,
    ratingCount: 0,
    commentsCount: 0,
  },
  myFeedback: {
    reaction: null,
    rating: null,
  },
  canInteract: false,
  isEnrolled: false,
  studentProfileId: null,
  comments: [],
};

const tabs: Array<{ id: CourseTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "curriculum", label: "Curriculum" },
  { id: "video", label: "Video" },
  { id: "resources", label: "Resources (PDF)" },
  { id: "reviews", label: "Reviews" },
];

const formatDate = (value?: string | null, withTime = false) => {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return withTime ? parsed.toLocaleString() : parsed.toLocaleDateString();
};

const formatCurrency = (amount?: number) => `INR ${Number(amount || 0).toLocaleString()}`;

const formatTime = (seconds: number) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

const getPdfFileName = (path?: string | null) => {
  if (!path) return "Course Resource.pdf";
  const raw = path.split("/").filter(Boolean).pop();
  return raw || "Course Resource.pdf";
};

const renderStars = (value: number) => {
  const safe = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <div className={styles.reviewStars} aria-label={`Rating ${safe} of 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index}>{index < safe ? "\u2605" : "\u2606"}</span>
      ))}
    </div>
  );
};

const loadRazorpayScript = () =>
  new Promise<boolean>((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true));
      existingScript.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

function CourseDetailsSkeleton() {
  return (
    <div className={styles.skeletonWrap}>
      <div className={styles.skeletonLine} style={{ width: 260, height: 14 }} />
      <div className={styles.skeletonLine} style={{ width: 420, height: 38 }} />
      <div className={styles.skeletonHero} />
      <div className={styles.skeletonStats}>
        {Array.from({ length: 5 }).map((_, idx) => (
          <div key={idx} className={styles.skeletonLine} style={{ height: 90 }} />
        ))}
      </div>
      <div className={styles.skeletonTabs} />
      <div className={styles.skeletonPanel} />
    </div>
  );
}

export default function CourseDetailsPage() {
  const { id } = useParams() as { id: string };
  const { user } = useAuth();
  const router = useRouter();

  const [course, setCourse] = useState<CourseDetails | null>(null);
  const [enrolments, setEnrolments] = useState<EnrolmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [enrolling, setEnrolling] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [enrolmentError, setEnrolmentError] = useState("");
  const [enrolmentSuccess, setEnrolmentSuccess] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [engagement, setEngagement] = useState<VideoEngagementData>(emptyEngagement);
  const [engagementLoading, setEngagementLoading] = useState(false);
  const [engagementError, setEngagementError] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentSort, setCommentSort] = useState<"newest" | "oldest">("newest");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [commentActionLoadingId, setCommentActionLoadingId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<CourseTab>("overview");
  const [wishlisted, setWishlisted] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [messageTone, setMessageTone] = useState<MessageTone>("neutral");

  const [videoProgress, setVideoProgress] = useState(0);
  const [videoCurrent, setVideoCurrent] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  const tabsRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const isStudent = user?.role === "student";
  const isAdmin = user?.role === "admin";
  const isTrainer = user?.role === "trainer";
  const canManage = isAdmin || isTrainer;

  useEffect(() => {
    if (!actionMessage) return;
    const timeout = window.setTimeout(() => setActionMessage(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [actionMessage]);

  const pushMessage = useCallback((message: string, tone: MessageTone = "neutral") => {
    setMessageTone(tone);
    setActionMessage(message);
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    API.get(`/courses/${id}`)
      .then((res) => {
        if (!mounted) return;
        const data = res.data?.data;
        setCourse(data?.course || null);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setError(message || "Failed to load course.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    if (!["admin", "trainer", "student"].includes(user.role)) return;

    let mounted = true;
    const limit = user.role === "student" ? 1 : 500;

    API.get(`/enrolments?courseId=${id}&limit=${limit}`)
      .then((res) => {
        if (!mounted) return;
        const data = res.data?.data;
        setEnrolments(Array.isArray(data?.enrolments) ? data.enrolments : []);
      })
      .catch(() => {
        if (mounted) setEnrolments([]);
      });

    return () => {
      mounted = false;
    };
  }, [id, user]);
  useEffect(() => {
    if (!user?._id || !id) return;
    const key = `wishlist:${user._id}`;
    try {
      const raw = localStorage.getItem(key);
      const list = raw ? (JSON.parse(raw) as string[]) : [];
      setWishlisted(list.includes(id));
    } catch {
      setWishlisted(false);
    }
  }, [id, user?._id]);

  const loadVideoEngagement = useCallback(async () => {
    if (!user || !id) return;
    if (!["admin", "trainer", "student", "finance"].includes(user.role)) return;

    setEngagementLoading(true);
    setEngagementError("");

    try {
      const res = await API.get(`/courses/${id}/video-engagement?sort=${commentSort}`);
      const data = res.data?.data;
      setEngagement(data || emptyEngagement);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setEngagementError(message || "Failed to load video feedback.");
      setEngagement(emptyEngagement);
    } finally {
      setEngagementLoading(false);
    }
  }, [commentSort, id, user]);

  useEffect(() => {
    loadVideoEngagement();
  }, [loadVideoEngagement]);

  const videoUrl = resolveAssetUrl(course?.videoUrl);
  const pdfUrl = resolveAssetUrl(course?.pdfUrl);
  const thumbnailUrl = resolveAssetUrl(course?.thumbnailUrl);
  const meetingLink = typeof course?.meetingLink === "string" ? course.meetingLink.trim() : "";

  const myEnrolment = isStudent ? enrolments[0] : null;
  const isSelfEnrolled = isStudent && (engagement.isEnrolled || Boolean(myEnrolment));

  const currentEnrolments = Number(course?.enrolmentCount ?? 0);
  const hasCapacityLimit = typeof course?.maxEnrolments === "number" && course.maxEnrolments > 0;
  const maxEnrolments = hasCapacityLimit ? Number(course?.maxEnrolments) : null;
  const maxReached = Boolean(maxEnrolments && currentEnrolments >= maxEnrolments);
  const enrolmentPercent = maxEnrolments ? Math.min((currentEnrolments / maxEnrolments) * 100, 100) : 0;

  const courseProgress = Math.max(0, Math.min(100, Number(myEnrolment?.progress || 0)));
  const isCourseActive = course?.isActive !== false;
  const courseFee = Number(course?.fee || 0);
  const requiresPayment = isStudent && !isSelfEnrolled && courseFee > 0;

  const primaryCtaLabel = useMemo(() => {
    if (isStudent) {
      if (isSelfEnrolled) return "Continue Learning";
      if (paymentLoading) return "Processing Payment...";
      if (requiresPayment) return "Pay & Enroll";
      if (enrolling) return "Enrolling...";
      if (maxReached) return "Course Full";
      return "Enroll Now";
    }
    if (isAdmin) return "Edit Course";
    if (isTrainer) return "Open Assignments";
    return "Back to Courses";
  }, [enrolling, isAdmin, isSelfEnrolled, isStudent, isTrainer, maxReached, paymentLoading, requiresPayment]);

  const primaryCtaDisabled = useMemo(() => {
    if (!isStudent) return false;
    return enrolling || paymentLoading || !isCourseActive || maxReached;
  }, [enrolling, isCourseActive, isStudent, maxReached, paymentLoading]);

  const handleShare = async () => {
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    if (!shareUrl) return;

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: course?.title || "Course", url: shareUrl });
        pushMessage("Course link shared.", "success");
        return;
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        pushMessage("Course link copied to clipboard.", "success");
      } else {
        pushMessage("Copy the URL from your browser to share this course.");
      }
    } catch {
      pushMessage("Share was cancelled.");
    }
  };

  const handleDeleteCourse = async () => {
    if (!isAdmin || !id) return;
    const confirmed = window.confirm("Delete this course? This will deactivate the course for learners.");
    if (!confirmed) return;

    setDeleting(true);
    try {
      await API.delete(`/courses/${id}`);
      pushMessage("Course deactivated successfully.", "success");
      router.push("/admin/courses");
      router.refresh();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      pushMessage(message || "Failed to delete course.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const closePaymentModal = () => {
    if (paymentLoading) return;
    setShowPaymentModal(false);
  };

  const handleSelfEnroll = async () => {
    if (!id || user?.role !== "student") return;
    if (!isCourseActive) {
      setEnrolmentError("This course is currently inactive.");
      return;
    }
    if (maxReached) {
      setEnrolmentError("This course has reached maximum enrolment capacity.");
      return;
    }

    setEnrolling(true);
    setEnrolmentError("");
    setEnrolmentSuccess("");

    try {
      const response = await API.post("/enrolments", { courseId: id });
      const created = response.data?.data?.enrolment;
      if (created) setEnrolments([created]);

      setCourse((prev) => {
        if (!prev) return prev;
        return { ...prev, enrolmentCount: (prev.enrolmentCount || 0) + 1 };
      });

      setEnrolmentSuccess("Enrollment successful. You can now access video and reviews.");
      pushMessage("You are enrolled in this course.", "success");
      await loadVideoEngagement();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setEnrolmentError(message || "Failed to enroll in this course.");
    } finally {
      setEnrolling(false);
    }
  };

  const handleRazorpayEnrollment = async () => {
    if (!id || user?.role !== "student" || !course) return;

    setEnrolling(true);
    setPaymentLoading(true);
    setEnrolmentError("");
    setEnrolmentSuccess("");

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        throw new Error("Unable to load Razorpay checkout script.");
      }

      const orderResponse = await API.post("/payments/razorpay/order", { courseId: id });
      const payload = orderResponse.data?.data as
        | {
            keyId: string;
            order: { id: string; amount: number; currency: string };
            student?: { name?: string; email?: string };
            course?: { title?: string };
          }
        | undefined;

      if (!payload?.keyId || !payload?.order?.id) {
        throw new Error("Invalid Razorpay order response.");
      }

      const verificationResponse = await new Promise<
        { data?: { data?: { enrolment?: EnrolmentRow }; message?: string } } | undefined
      >((resolve, reject) => {
        const RazorpayCtor = window.Razorpay;
        if (!RazorpayCtor) {
          reject(new Error("Razorpay checkout is unavailable."));
          return;
        }

        const razorpay = new RazorpayCtor({
          key: payload.keyId,
          amount: payload.order.amount,
          currency: payload.order.currency || "INR",
          name: "LMS",
          description: `Enroll in ${payload.course?.title || course.title}`,
          order_id: payload.order.id,
          prefill: {
            name: payload.student?.name || "",
            email: payload.student?.email || "",
          },
          notes: {
            courseId: id,
          },
          theme: {
            color: "#2563EB",
          },
          handler: async (response: RazorpayHandlerResponse) => {
            try {
              const verify = await API.post("/payments/razorpay/verify-and-enroll", {
                courseId: id,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              resolve(verify);
            } catch (verificationError) {
              reject(verificationError);
            }
          },
        });

        razorpay.on("payment.failed", (failure) => {
          reject(failure);
        });

        razorpay.open();
      });

      const verificationMessage = String(verificationResponse?.data?.message || "");
      const verifiedEnrolment = verificationResponse?.data?.data?.enrolment;

      if (verifiedEnrolment) {
        setEnrolments([verifiedEnrolment]);
      }

      if (!/already enrolled/i.test(verificationMessage)) {
        setCourse((prev) => {
          if (!prev) return prev;
          return { ...prev, enrolmentCount: (prev.enrolmentCount || 0) + 1 };
        });
      }

      setShowPaymentModal(false);
      setEnrolmentSuccess("Payment successful. Enrollment completed.");
      pushMessage("Payment verified and enrollment completed.", "success");
      await loadVideoEngagement();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as { error?: { description?: string } })?.error?.description ||
        (err as { message?: string })?.message;
      setEnrolmentError(message || "Payment failed. Enrollment not completed.");
    } finally {
      setPaymentLoading(false);
      setEnrolling(false);
    }
  };

  const handlePrimaryCta = async () => {
    if (isStudent) {
      if (isSelfEnrolled) {
        setActiveTab("video");
        tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (requiresPayment) {
        setEnrolmentError("");
        setEnrolmentSuccess("");
        setShowPaymentModal(true);
        return;
      }
      await handleSelfEnroll();
      return;
    }

    if (isAdmin) {
      router.push(`/admin/courses/${id}/edit`);
      return;
    }

    if (isTrainer) {
      router.push("/trainer/assignments");
      return;
    }

    router.push("/admin/courses");
  };

  const toggleWishlist = () => {
    if (!user?._id || !id) return;

    const key = `wishlist:${user._id}`;
    const next = !wishlisted;
    try {
      const raw = localStorage.getItem(key);
      const list = raw ? (JSON.parse(raw) as string[]) : [];
      const nextList = next ? Array.from(new Set([...list, id])) : list.filter((courseId) => courseId !== id);
      localStorage.setItem(key, JSON.stringify(nextList));
      setWishlisted(next);
      pushMessage(next ? "Added to wishlist." : "Removed from wishlist.", "success");
    } catch {
      pushMessage("Could not update wishlist right now.", "error");
    }
  };

  const updateVideoFeedback = async (payload: { reaction?: ReactionType; rating?: number | null }) => {
    if (!id || user?.role !== "student" || !engagement.canInteract) return;
    setFeedbackSaving(true);
    setEngagementError("");

    try {
      const res = await API.put(`/courses/${id}/video-feedback?sort=${commentSort}`, payload);
      const data = res.data?.data;
      if (data) setEngagement(data);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setEngagementError(message || "Failed to update video feedback.");
    } finally {
      setFeedbackSaving(false);
    }
  };
  const handleReactionToggle = async (reactionType: Exclude<ReactionType, null>) => {
    const nextReaction = engagement.myFeedback.reaction === reactionType ? null : reactionType;
    await updateVideoFeedback({ reaction: nextReaction });
  };

  const handleRatingSelect = async (ratingValue: number) => {
    const nextRating = engagement.myFeedback.rating === ratingValue ? null : ratingValue;
    await updateVideoFeedback({ rating: nextRating });
  };

  const handleCommentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id || user?.role !== "student" || !engagement.canInteract) return;

    const trimmedComment = commentText.trim();
    if (!trimmedComment) {
      setEngagementError("Please enter a review comment.");
      return;
    }

    setCommentSaving(true);
    setEngagementError("");

    try {
      const res = await API.post(`/courses/${id}/video-comments?sort=${commentSort}`, { comment: trimmedComment });
      const data = res.data?.data;
      if (data) setEngagement(data);
      setCommentText("");
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setEngagementError(message || "Failed to post review.");
    } finally {
      setCommentSaving(false);
    }
  };

  const beginEditComment = (comment: VideoComment) => {
    if (!comment.isMine) return;
    setEditingCommentId(comment._id);
    setEditingCommentText(comment.comment);
    setEngagementError("");
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText("");
  };

  const saveEditedComment = async (commentId: string) => {
    if (!id || user?.role !== "student" || !engagement.canInteract) return;

    const trimmedComment = editingCommentText.trim();
    if (!trimmedComment) {
      setEngagementError("Please enter a review comment.");
      return;
    }

    setCommentActionLoadingId(commentId);
    setEngagementError("");

    try {
      const res = await API.put(`/courses/${id}/video-comments/${commentId}?sort=${commentSort}`, {
        comment: trimmedComment,
      });
      const data = res.data?.data;
      if (data) setEngagement(data);
      cancelEditComment();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setEngagementError(message || "Failed to update review.");
    } finally {
      setCommentActionLoadingId(null);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!id || user?.role !== "student" || !engagement.canInteract) return;

    const confirmed = window.confirm("Delete this review?");
    if (!confirmed) return;

    setCommentActionLoadingId(commentId);
    setEngagementError("");

    try {
      const res = await API.delete(`/courses/${id}/video-comments/${commentId}?sort=${commentSort}`);
      const data = res.data?.data;
      if (data) setEngagement(data);
      if (editingCommentId === commentId) cancelEditComment();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setEngagementError(message || "Failed to delete review.");
    } finally {
      setCommentActionLoadingId(null);
    }
  };

  const handleTrainerReplyClick = (name: string) => {
    pushMessage(`Reply to ${name} can be enabled once trainer reply API is added.`);
  };

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime || 0;
    const duration = videoRef.current.duration || 0;
    setVideoCurrent(current);
    setVideoDuration(duration);
    setVideoProgress(duration > 0 ? (current / duration) * 100 : 0);
  };

  const modules = course?.modules || [];

  return (
    <ProtectedRoute role={["admin", "trainer", "student", "finance"]}>
      <DashboardLayout>
        <div className={styles.pageShell}>
          {loading ? (
            <CourseDetailsSkeleton />
          ) : error ? (
            <div className="error-msg">{error}</div>
          ) : !course ? (
            <div className="error-msg">Course not found.</div>
          ) : (
            <>
              <header className={styles.headerRow}>
                <div>
                  <p className={styles.breadcrumb}>
                    Dashboard / {isStudent ? "My Courses" : "Courses"} / Course Details
                  </p>
                  <div className={styles.headingLine}>
                    <h1 className={styles.pageHeading}>{course.title}</h1>
                    <span className={`${styles.statusPill} ${isCourseActive ? styles.statusActive : styles.statusInactive}`}>
                      {isCourseActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                <div className={styles.headerActions}>
                  <button type="button" className={styles.actionButton} onClick={() => router.back()}>
                    Back
                  </button>
                  <button type="button" className={styles.actionButton} onClick={handleShare}>
                    Share
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      className={`${styles.actionButton} ${styles.actionPrimary}`}
                      onClick={() => router.push(`/admin/courses/${id}/edit`)}
                    >
                      Edit
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      className={`${styles.actionButton} ${styles.actionDanger}`}
                      onClick={handleDeleteCourse}
                      disabled={deleting}
                    >
                      {deleting ? "Deleting..." : "Delete"}
                    </button>
                  )}
                </div>
              </header>

              {actionMessage && (
                <div
                  className={`${styles.messageBanner} ${
                    messageTone === "success"
                      ? styles.messageSuccess
                      : messageTone === "error"
                        ? styles.messageError
                        : ""
                  }`}
                >
                  {actionMessage}
                </div>
              )}

              <section className={styles.heroCard}>
                <div className={styles.heroCopy}>
                  <span className={styles.categoryBadge}>{course.category || "General"}</span>
                  <h2 className={styles.courseTitle}>{course.title}</h2>
                  <p className={styles.courseDescription}>
                    {course.description?.trim() || "No course description yet. Add one to improve learner clarity."}
                  </p>

                  <div className={styles.heroActions}>
                    <button
                      type="button"
                      className={styles.primaryCta}
                      onClick={handlePrimaryCta}
                      disabled={primaryCtaDisabled}
                    >
                      {primaryCtaLabel}
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryCta}
                      onClick={isStudent ? toggleWishlist : handleShare}
                    >
                      {isStudent ? (wishlisted ? "Wishlisted" : "Add to Wishlist") : "Copy Link"}
                    </button>
                    {meetingLink && (
                      <a
                        href={meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.secondaryCta}
                      >
                        Join Live Meet
                      </a>
                    )}
                  </div>

                  {isStudent && maxReached && !isSelfEnrolled && (
                    <p className={styles.heroNote}>Enrollment is currently full for this course.</p>
                  )}
                  {enrolmentError && <div className="error-msg">{enrolmentError}</div>}
                  {enrolmentSuccess && <div className="success-msg">{enrolmentSuccess}</div>}
                </div>

                <div className={styles.heroMedia}>
                  <div className={styles.mediaFrame}>
                    {thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbnailUrl} alt={course.title} className={styles.mediaPreview} />
                    ) : videoUrl ? (
                      <video className={styles.mediaPreview} muted loop autoPlay playsInline>
                        <source src={videoUrl} />
                      </video>
                    ) : (
                      <div className={styles.mediaPlaceholder}>Preview Not Available</div>
                    )}
                  </div>
                  <div className={styles.mediaMeta}>
                    <span className={styles.metaBadge}>{course.level || "beginner"}</span>
                    <span className={styles.metaBadge}>{course.duration || "Self paced"}</span>
                    <span className={styles.metaBadge}>{course.trainerId?.name || "Trainer pending"}</span>
                  </div>
                </div>
              </section>

              <section className={styles.statsGrid}>
                <article className={styles.statCard}>
                  <p className={styles.statLabel}>Fee</p>
                  <p className={styles.statValue}>{formatCurrency(course.fee)}</p>
                </article>
                <article className={styles.statCard}>
                  <p className={styles.statLabel}>Trainer</p>
                  <p className={styles.statValue}>{course.trainerId?.name || "Unassigned"}</p>
                </article>
                <article className={styles.statCard}>
                  <p className={styles.statLabel}>Duration</p>
                  <p className={styles.statValue}>{course.duration || "Not set"}</p>
                </article>
                <article className={styles.statCard}>
                  <p className={styles.statLabel}>Max Enrollments</p>
                  <p className={styles.statValue}>{maxEnrolments || "No limit"}</p>
                </article>
                <article className={styles.statCard}>
                  <p className={styles.statLabel}>Current Enrolled</p>
                  <p className={styles.statValue}>{currentEnrolments}</p>
                </article>
                <article className={styles.statCard}>
                  <p className={styles.statLabel}>Live Class</p>
                  <p className={styles.statValue}>{meetingLink ? "Meet Enabled" : "Not Added"}</p>
                </article>
              </section>
              <section className={styles.progressGrid}>
                <article className={styles.progressCard}>
                  <div className={styles.progressHead}>
                    <p className={styles.cardTitle}>Enrollment Capacity</p>
                    <p className={styles.progressMeta}>
                      {maxEnrolments ? `${currentEnrolments}/${maxEnrolments}` : `${currentEnrolments} enrolled`}
                    </p>
                  </div>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressFill} style={{ width: `${maxEnrolments ? enrolmentPercent : 35}%` }} />
                  </div>
                  <p className={styles.progressHint}>
                    {maxEnrolments
                      ? maxReached
                        ? "Enrollment capacity reached."
                        : `${Math.max(0, maxEnrolments - currentEnrolments)} seats remaining.`
                      : "Open enrollment. No maximum seat limit."}
                  </p>
                </article>

                {isSelfEnrolled && (
                  <article className={styles.progressCard}>
                    <div className={styles.progressHead}>
                      <p className={styles.cardTitle}>Your Course Progress</p>
                      <p className={styles.progressMeta}>{courseProgress}%</p>
                    </div>
                    <div className={styles.progressTrack}>
                      <div className={styles.progressFill} style={{ width: `${courseProgress}%` }} />
                    </div>
                    <p className={styles.progressHint}>Stay consistent to complete this course faster.</p>
                  </article>
                )}
              </section>

              {isStudent && (
                <section className={styles.stickyCta}>
                  <div className={styles.stickyText}>
                    <p className={styles.stickyTitle}>
                      {isSelfEnrolled ? "You are enrolled in this course" : "Start learning with this course"}
                    </p>
                    <p className={styles.stickySub}>
                      {isSelfEnrolled
                        ? "Continue where you left off and track your progress."
                        : maxReached
                          ? "Seats are currently full. Check back soon."
                          : "Enroll now to unlock video engagement and reviews."}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.stickyButton}
                    disabled={primaryCtaDisabled}
                    onClick={handlePrimaryCta}
                  >
                    {primaryCtaLabel}
                  </button>
                </section>
              )}

              <section className={styles.tabsSection} ref={tabsRef}>
                <div className={styles.tabBar}>
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`${styles.tabButton} ${activeTab === tab.id ? styles.tabButtonActive : ""}`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className={styles.tabContent}>
                  {activeTab === "overview" && (
                    <div className={styles.overviewGrid}>
                      <article className={styles.panelCard}>
                        <h3 className={styles.panelHeading}>Course Overview</h3>
                        <p className={styles.panelSub}>
                          {course.description?.trim() || "No detailed course summary is available yet."}
                        </p>
                        <div className={styles.chipRow}>
                          <span className={styles.chip}>{course.category || "General"}</span>
                          <span className={styles.chip}>{course.level || "beginner"}</span>
                          <span className={styles.chip}>{course.duration || "Self paced"}</span>
                          <span className={styles.chip}>{isCourseActive ? "Published" : "Inactive"}</span>
                        </div>
                      </article>

                      <article className={styles.panelCard}>
                        <h3 className={styles.panelHeading}>Details</h3>
                        <div className={styles.keyGrid}>
                          <div className={styles.keyRow}>
                            <span className={styles.keyLabel}>Trainer</span>
                            <span className={styles.keyValue}>{course.trainerId?.name || "Unassigned"}</span>
                          </div>
                          <div className={styles.keyRow}>
                            <span className={styles.keyLabel}>Specialization</span>
                            <span className={styles.keyValue}>{course.trainerId?.specialization || "General"}</span>
                          </div>
                          <div className={styles.keyRow}>
                            <span className={styles.keyLabel}>Start Date</span>
                            <span className={styles.keyValue}>{formatDate(course.startDate)}</span>
                          </div>
                          <div className={styles.keyRow}>
                            <span className={styles.keyLabel}>End Date</span>
                            <span className={styles.keyValue}>{formatDate(course.endDate)}</span>
                          </div>
                          <div className={styles.keyRow}>
                            <span className={styles.keyLabel}>Created</span>
                            <span className={styles.keyValue}>{formatDate(course.createdAt)}</span>
                          </div>
                          <div className={styles.keyRow}>
                            <span className={styles.keyLabel}>Live Session</span>
                            <span className={styles.keyValue}>
                              {meetingLink ? (
                                <a href={meetingLink} target="_blank" rel="noreferrer" className={styles.reviewButton}>
                                  Open Meet
                                </a>
                              ) : (
                                "Not configured"
                              )}
                            </span>
                          </div>
                        </div>
                      </article>
                    </div>
                  )}

                  {activeTab === "curriculum" && (
                    <div className={styles.curriculumList}>
                      {modules.length === 0 ? (
                        <div className={styles.emptyState}>
                          <div className={styles.emptyIcon}>C</div>
                          <h4 className={styles.emptyTitle}>Curriculum not published</h4>
                          <p className={styles.emptyText}>
                            Modules and lessons are not added yet for this course.
                          </p>
                        </div>
                      ) : (
                        modules.map((moduleItem, moduleIndex) => {
                          const lessons = Array.isArray(moduleItem.lessons) ? moduleItem.lessons : [];
                          return (
                            <article key={`${moduleItem.title || "module"}-${moduleIndex}`} className={styles.moduleCard}>
                              <div className={styles.moduleHead}>
                                <div>
                                  <span className={styles.moduleNumber}>Module {moduleIndex + 1}</span>
                                  <h4 className={styles.moduleTitle}>{moduleItem.title || `Untitled Module ${moduleIndex + 1}`}</h4>
                                </div>
                                <span className={styles.moduleInfo}>{lessons.length} lesson(s)</span>
                              </div>

                              <div className={styles.lessonList}>
                                {lessons.length === 0 ? (
                                  <p className={styles.emptyText}>No lessons yet in this module.</p>
                                ) : (
                                  lessons.map((lesson, lessonIndex) => (
                                    <div key={`${lesson.title || "lesson"}-${lessonIndex}`} className={styles.lessonRow}>
                                      <div className={styles.lessonLeft}>
                                        <span className={styles.lessonIndex}>{lessonIndex + 1}</span>
                                        <div>
                                          <p className={styles.lessonTitle}>{lesson.title || `Lesson ${lessonIndex + 1}`}</p>
                                          <p className={styles.lessonMeta}>
                                            {(lesson.videoUrl ? "Video " : "") +
                                              (lesson.pdfUrl ? "PDF " : "") +
                                              (lesson.quizTitle ? "Quiz " : "") +
                                              (lesson.assignmentTitle ? "Assignment" : "") ||
                                              "Content details pending"}
                                          </p>
                                        </div>
                                      </div>
                                      <div className={styles.lessonTags}>
                                        {lesson.videoUrl && <span className={styles.lessonTag}>Video</span>}
                                        {lesson.pdfUrl && <span className={styles.lessonTag}>PDF</span>}
                                        {lesson.quizTitle && <span className={styles.lessonTag}>Quiz</span>}
                                        {lesson.assignmentTitle && <span className={styles.lessonTag}>Assignment</span>}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </article>
                          );
                        })
                      )}

                      {canManage && (
                        <article className={styles.panelCard}>
                          <h3 className={styles.panelHeading}>Enrolled Learners</h3>
                          {enrolments.length === 0 ? (
                            <div className={styles.emptyState}>
                              <div className={styles.emptyIcon}>S</div>
                              <h4 className={styles.emptyTitle}>No enrollments yet</h4>
                              <p className={styles.emptyText}>Learner list will appear here after enrollments.</p>
                            </div>
                          ) : (
                            <div className={styles.studentTableWrap}>
                              <table className={styles.studentTable}>
                                <thead>
                                  <tr>
                                    <th>Student</th>
                                    <th>Status</th>
                                    <th>Progress</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {enrolments.map((row) => (
                                    <tr key={row._id}>
                                      <td>
                                        <p className={styles.studentName}>{row.studentId?.name || "Student"}</p>
                                        <p className={styles.studentEmail}>{row.studentId?.email || "-"}</p>
                                      </td>
                                      <td>{row.status}</td>
                                      <td>
                                        <div className={styles.studentProgressWrap}>
                                          <div className={styles.studentProgressTrack}>
                                            <div
                                              className={styles.studentProgressFill}
                                              style={{ width: `${Math.max(0, Math.min(100, row.progress || 0))}%` }}
                                            />
                                          </div>
                                          <span className={styles.studentProgressLabel}>{Math.round(row.progress || 0)}%</span>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </article>
                      )}
                    </div>
                  )}
                  {activeTab === "video" && (
                    <article className={styles.panelCard}>
                      <h3 className={styles.panelHeading}>Course Video</h3>

                      {!videoUrl ? (
                        <div className={styles.emptyState}>
                          <div className={styles.emptyIcon}>V</div>
                          <h4 className={styles.emptyTitle}>Video content unavailable</h4>
                          <p className={styles.emptyText}>Video will appear once uploaded by your instructor.</p>
                        </div>
                      ) : (
                        <>
                          <div className={styles.videoFrame}>
                            <video
                              ref={videoRef}
                              controls
                              className={styles.videoElement}
                              onLoadedMetadata={handleVideoTimeUpdate}
                              onTimeUpdate={handleVideoTimeUpdate}
                            >
                              <source src={videoUrl} />
                              Your browser does not support video playback.
                            </video>
                          </div>

                          <div className={styles.videoProgressRow}>
                            <div className={styles.progressTrack}>
                              <div className={styles.progressFill} style={{ width: `${videoProgress}%` }} />
                            </div>
                            <span className={styles.timeLabel}>
                              {formatTime(videoCurrent)} / {formatTime(videoDuration)}
                            </span>
                          </div>

                          <div className={styles.pillRow}>
                            <span className={`${styles.pill} ${styles.pillBlue}`}>Likes: {engagement.summary.likes}</span>
                            <span className={`${styles.pill} ${styles.pillRed}`}>Dislikes: {engagement.summary.dislikes}</span>
                            <span className={`${styles.pill} ${styles.pillAmber}`}>
                              Avg Rating: {engagement.summary.ratingAverage.toFixed(1)} / 5
                            </span>
                            <span className={`${styles.pill} ${styles.pillGreen}`}>Ratings: {engagement.summary.ratingCount}</span>
                            <span className={`${styles.pill} ${styles.pillSlate}`}>Comments: {engagement.summary.commentsCount}</span>
                          </div>

                          {isStudent && (
                            <div className={styles.feedbackPanel}>
                              <h4 className={styles.feedbackHeading}>Engage with this video</h4>
                              {!engagement.canInteract ? (
                                <p className={styles.emptyText}>Video engagement is currently unavailable for your account.</p>
                              ) : (
                                <>
                                  <div className={styles.reactionRow}>
                                    <button
                                      type="button"
                                      className={`${styles.reactionBtn} ${
                                        engagement.myFeedback.reaction === "like" ? styles.reactionLikeActive : ""
                                      }`}
                                      onClick={() => handleReactionToggle("like")}
                                      disabled={feedbackSaving}
                                    >
                                      Like
                                    </button>
                                    <button
                                      type="button"
                                      className={`${styles.reactionBtn} ${
                                        engagement.myFeedback.reaction === "dislike" ? styles.reactionDislikeActive : ""
                                      }`}
                                      onClick={() => handleReactionToggle("dislike")}
                                      disabled={feedbackSaving}
                                    >
                                      Dislike
                                    </button>
                                  </div>

                                  <div className={styles.ratingRow}>
                                    {Array.from({ length: 5 }).map((_, index) => {
                                      const value = index + 1;
                                      const active = value <= Number(engagement.myFeedback.rating || 0);
                                      return (
                                        <button
                                          key={value}
                                          type="button"
                                          className={`${styles.ratingBtn} ${active ? styles.ratingBtnActive : ""}`}
                                          onClick={() => handleRatingSelect(value)}
                                          disabled={feedbackSaving}
                                        >
                                          {active ? "\u2605" : "\u2606"}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </>
                              )}

                              {engagementError && <div className="error-msg">{engagementError}</div>}
                            </div>
                          )}
                        </>
                      )}
                    </article>
                  )}

                  {activeTab === "resources" && (
                    <article className={styles.panelCard}>
                      <h3 className={styles.panelHeading}>Course Resources</h3>
                      {!pdfUrl ? (
                        <div className={styles.emptyState}>
                          <div className={styles.emptyIcon}>P</div>
                          <h4 className={styles.emptyTitle}>No resources available yet</h4>
                          <p className={styles.emptyText}>PDF notes and documents will appear here.</p>
                        </div>
                      ) : (
                        <>
                          <div className={styles.resourceCard}>
                            <div className={styles.resourceLeft}>
                              <div className={styles.resourceIcon}>PDF</div>
                              <div>
                                <p className={styles.resourceName}>{getPdfFileName(course.pdfUrl)}</p>
                                <p className={styles.resourceHint}>Primary course document</p>
                              </div>
                            </div>

                            <div className={styles.resourceActions}>
                              <a href={pdfUrl} target="_blank" rel="noreferrer" className={styles.resourceGhost}>
                                View
                              </a>
                              <a href={pdfUrl} target="_blank" rel="noreferrer" className={styles.resourcePrimary}>
                                Download
                              </a>
                            </div>
                          </div>

                          <iframe title="Course PDF Preview" src={pdfUrl} className={styles.pdfFrame} />
                        </>
                      )}
                    </article>
                  )}

                  {activeTab === "reviews" && (
                    <article className={styles.panelCard}>
                      <div className={styles.reviewHeader}>
                        <div>
                          <h3 className={styles.panelHeading}>Learner Reviews</h3>
                          <p className={styles.panelSub}>
                            Average {engagement.summary.ratingAverage.toFixed(1)} from {engagement.summary.ratingCount} rating(s)
                          </p>
                        </div>
                        <select
                          className={styles.reviewSort}
                          value={commentSort}
                          onChange={(e) => setCommentSort(e.target.value === "oldest" ? "oldest" : "newest")}
                        >
                          <option value="newest">Newest first</option>
                          <option value="oldest">Oldest first</option>
                        </select>
                      </div>

                      <div className={styles.pillRow}>
                        <span className={`${styles.pill} ${styles.pillAmber}`}>{renderStars(engagement.summary.ratingAverage)}</span>
                        <span className={`${styles.pill} ${styles.pillSlate}`}>
                          {engagement.summary.commentsCount} comment(s)
                        </span>
                      </div>

                      {isStudent && engagement.canInteract && (
                        <form className={styles.commentForm} onSubmit={handleCommentSubmit}>
                          <textarea
                            className={styles.commentText}
                            rows={4}
                            maxLength={1000}
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Write your review..."
                          />
                          <div className={styles.commentToolbar}>
                            <span className={styles.charCount}>{commentText.length}/1000</span>
                            <button type="submit" className={styles.smallPrimaryButton} disabled={commentSaving}>
                              {commentSaving ? "Posting..." : "Post Review"}
                            </button>
                          </div>
                        </form>
                      )}

                      {engagementError && <div className="error-msg">{engagementError}</div>}
                      {engagementLoading ? (
                        <div className={styles.skeletonWrap}>
                          <div className={styles.skeletonLine} style={{ height: 100 }} />
                          <div className={styles.skeletonLine} style={{ height: 100 }} />
                        </div>
                      ) : engagement.comments.length === 0 ? (
                        <div className={styles.emptyState}>
                          <div className={styles.emptyIcon}>R</div>
                          <h4 className={styles.emptyTitle}>Be the first to review this course</h4>
                          <p className={styles.emptyText}>Your feedback helps improve the learning experience.</p>
                        </div>
                      ) : (
                        <div className={styles.reviewList}>
                          {engagement.comments.map((comment) => {
                            const isEditing = editingCommentId === comment._id;
                            const isBusy = commentActionLoadingId === comment._id;
                            const canManageComment = isStudent && comment.isMine;
                            const reviewName = comment.studentId?.name || "Student";
                            const reviewScore =
                              canManageComment && engagement.myFeedback.rating
                                ? engagement.myFeedback.rating
                                : engagement.summary.ratingAverage;

                            return (
                              <article key={comment._id} className={styles.reviewCard}>
                                <div className={styles.reviewAvatar}>{reviewName.charAt(0).toUpperCase()}</div>

                                <div className={styles.reviewBody}>
                                  <div className={styles.reviewTop}>
                                    <div>
                                      <p className={styles.reviewName}>{reviewName}</p>
                                      <p className={styles.reviewTime}>{formatDate(comment.createdAt, true)}</p>
                                    </div>
                                    {renderStars(Number(reviewScore || 0))}
                                  </div>

                                  {isEditing ? (
                                    <>
                                      <textarea
                                        className={styles.commentText}
                                        rows={3}
                                        maxLength={1000}
                                        value={editingCommentText}
                                        onChange={(e) => setEditingCommentText(e.target.value)}
                                      />
                                      <div className={styles.commentToolbar}>
                                        <span className={styles.charCount}>{editingCommentText.length}/1000</span>
                                        <div className={styles.reviewActions}>
                                          <button
                                            type="button"
                                            className={styles.smallButton}
                                            disabled={isBusy}
                                            onClick={cancelEditComment}
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            type="button"
                                            className={styles.smallPrimaryButton}
                                            disabled={isBusy}
                                            onClick={() => saveEditedComment(comment._id)}
                                          >
                                            {isBusy ? "Saving..." : "Save"}
                                          </button>
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <p className={styles.reviewText}>{comment.comment}</p>
                                      <div className={styles.reviewActions}>
                                        {canManageComment && (
                                          <>
                                            <button
                                              type="button"
                                              className={styles.reviewButton}
                                              onClick={() => beginEditComment(comment)}
                                              disabled={isBusy}
                                            >
                                              Edit
                                            </button>
                                            <button
                                              type="button"
                                              className={styles.reviewButton}
                                              onClick={() => deleteComment(comment._id)}
                                              disabled={isBusy}
                                            >
                                              {isBusy ? "Deleting..." : "Delete"}
                                            </button>
                                          </>
                                        )}
                                        {isTrainer && (
                                          <button
                                            type="button"
                                            className={styles.reviewButton}
                                            onClick={() => handleTrainerReplyClick(reviewName)}
                                          >
                                            Reply
                                          </button>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </article>
                  )}
                </div>
              </section>

              {isStudent && showPaymentModal && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 1200,
                    background: "rgba(15, 23, 42, 0.48)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      maxWidth: 460,
                      background: "#fff",
                      borderRadius: 16,
                      boxShadow: "0 20px 60px rgba(15,23,42,0.18)",
                      border: "1px solid #e2e8f0",
                      padding: 24,
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0f172a" }}>Complete Enrollment</h3>
                    <p style={{ marginTop: 8, marginBottom: 0, fontSize: 14, color: "#64748b" }}>
                      Course: <strong style={{ color: "#0f172a" }}>{course.title}</strong>
                    </p>

                    <div
                      style={{
                        marginTop: 16,
                        padding: 14,
                        borderRadius: 12,
                        border: "1px solid #e2e8f0",
                        background: "linear-gradient(145deg, #f8fafc, #eef2ff)",
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>Amount Payable</p>
                      <p style={{ marginTop: 6, marginBottom: 0, fontSize: 28, fontWeight: 800, color: "#0f172a" }}>
                        INR {courseFee.toLocaleString()}
                      </p>
                      <p style={{ marginTop: 8, marginBottom: 0, fontSize: 12, color: "#1d4ed8", fontWeight: 600 }}>
                        Payment Mode: Razorpay (Demo/Test Mode)
                      </p>
                    </div>

                    {enrolmentError && <div className="error-msg" style={{ marginTop: 12 }}>{enrolmentError}</div>}

                    <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                      <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleRazorpayEnrollment} disabled={paymentLoading}>
                        {paymentLoading ? "Processing..." : "Pay & Enroll"}
                      </button>
                      <button className="btn btn-ghost" onClick={closePaymentModal} disabled={paymentLoading}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
