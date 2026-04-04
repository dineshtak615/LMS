"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getDashboardRoute } from "@/components/ProtectedRoute";
import API, { resolveAssetUrl } from "@/services/api";

type PopularCourse = {
  _id: string;
  title: string;
  description?: string | null;
  duration?: string | null;
  fee?: number;
  category?: string | null;
  level?: string | null;
  thumbnailUrl?: string | null;
  trainerName?: string | null;
  enrolmentCount?: number;
  completionRate?: number;
};

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [countStudents, setCountStudents] = useState(0);
  const [countOrgs, setCountOrgs] = useState(0);
  const [countCourses, setCountCourses] = useState(0);
  const [popularCourses, setPopularCourses] = useState<PopularCourse[]>([]);
  const [popularLoading, setPopularLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && user) {
      router.push(getDashboardRoute(user.role));
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    let active = true;
    setPopularLoading(true);

    API.get("/courses/public/popular?limit=6")
      .then((response) => {
        if (!active) return;
        const list = response.data?.data?.courses;
        setPopularCourses(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!active) return;
        setPopularCourses([]);
      })
      .finally(() => {
        if (active) setPopularLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Animated counters
  useEffect(() => {
    const duration = 2000;
    const targets = { students: 12000, orgs: 300, courses: 850 };
    const steps = 60;
    const interval = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const ease = 1 - Math.pow(1 - progress, 3);
      setCountStudents(Math.floor(targets.students * ease));
      setCountOrgs(Math.floor(targets.orgs * ease));
      setCountCourses(Math.floor(targets.courses * ease));
      if (step >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, []);

  const features = [
    { icon: "🏢", title: "Multi-Tenant Architecture", desc: "Each organization gets a fully isolated environment with dedicated data, users, and settings. Scale from one institute to thousands." },
    { icon: "🔐", title: "Role-Based Access Control", desc: "Granular permissions for Super Admins, Admins, Trainers, Students, and Finance teams. Right access, right people." },
    { icon: "📊", title: "Real-Time Analytics", desc: "Track revenue, enrolment trends, course completion rates, and student progress with live dashboards." },
    { icon: "💰", title: "Integrated Payments", desc: "Record and track payments across methods — cash, UPI, card, bank transfer. Full financial reporting built in." },
    { icon: "📚", title: "Library Management", desc: "Digital library system with book issuance, return tracking, overdue management, and availability monitoring." },
    { icon: "🎓", title: "Course & Enrolment Engine", desc: "Create courses, assign trainers, manage capacity limits, track student progress, and issue completion records." },
  ];

  const testimonials = [
    { name: "Priya Sharma", role: "Director, TechLearn Institute", quote: "We moved 3 branches onto this platform in a week. The multi-tenant setup meant each branch has its own data with zero overlap." },
    { name: "Rajesh Kumar", role: "Admin, CodeCraft Academy", quote: "The payment tracking and financial dashboard alone saved us 6 hours a week of manual spreadsheet work." },
    { name: "Anita Verma", role: "Operations Head, EduPro", quote: "Our trainers love the clean dashboard. Students always know where they stand. Support team has zero complaints now." },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        :root {
          --navy: #0a1628;
          --navy-mid: #112240;
          --navy-light: #1d3557;
          --gold: #c9a84c;
          --gold-light: #e8c97a;
          --cream: #f5f0e8;
          --cream-dark: #ede8dc;
          --text: #1a1a2e;
          --text-mid: #3d4a5c;
          --text-light: #6b7a8d;
          --white: #ffffff;
        }

        html { scroll-behavior: smooth; }

        body {
          font-family: 'DM Sans', sans-serif;
          background: var(--white);
          color: var(--text);
          overflow-x: hidden;
        }

        .display { font-family: 'Playfair Display', serif; }

        /* NAV */
        .nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
          padding: 0 5%;
          display: flex; align-items: center; justify-content: space-between;
          height: 72px;
          transition: all 0.3s ease;
        }
        .nav.scrolled {
          background: rgba(10, 22, 40, 0.97);
          backdrop-filter: blur(12px);
          box-shadow: 0 1px 0 rgba(201, 168, 76, 0.2);
        }
        .nav-logo { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: var(--white); letter-spacing: 0.02em; }
        .nav-logo span { color: var(--gold); }
        .nav-links { display: flex; align-items: center; gap: 36px; }
        .nav-link { color: rgba(255,255,255,0.75); font-size: 14px; font-weight: 500; text-decoration: none; transition: color 0.2s; letter-spacing: 0.02em; }
        .nav-link:hover { color: var(--gold-light); }
        .nav-cta { background: var(--gold); color: var(--navy); padding: 10px 24px; border-radius: 4px; font-size: 14px; font-weight: 600; text-decoration: none; letter-spacing: 0.04em; transition: all 0.2s; }
        .nav-cta:hover { background: var(--gold-light); transform: translateY(-1px); }

        /* HERO */
        .hero {
          min-height: 100vh;
          background: var(--navy);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          position: relative; overflow: hidden;
          padding: 120px 5% 80px;
          text-align: center;
        }
        .hero-grid {
          position: absolute; inset: 0;
          background-image: 
            linear-gradient(rgba(201,168,76,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(201,168,76,0.07) 1px, transparent 1px);
          background-size: 60px 60px;
        }
        .hero-glow {
          position: absolute;
          width: 800px; height: 800px;
          background: radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 65%);
          top: 50%; left: 50%; transform: translate(-50%, -55%);
          pointer-events: none;
        }
        .hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(201,168,76,0.12);
          border: 1px solid rgba(201,168,76,0.3);
          color: var(--gold-light);
          padding: 8px 18px; border-radius: 999px;
          font-size: 13px; font-weight: 500; letter-spacing: 0.05em;
          margin-bottom: 28px;
          animation: fadeUp 0.8s ease forwards;
        }
        .hero-title {
          font-family: 'Playfair Display', serif;
          font-size: clamp(42px, 6vw, 78px);
          font-weight: 800;
          color: var(--white);
          line-height: 1.1;
          margin-bottom: 24px;
          max-width: 900px;
          animation: fadeUp 0.9s ease forwards;
        }
        .hero-title .gold { color: var(--gold); }
        .hero-subtitle {
          font-size: clamp(16px, 2vw, 20px);
          color: rgba(255,255,255,0.6);
          max-width: 580px;
          line-height: 1.7;
          margin-bottom: 44px;
          font-weight: 300;
          animation: fadeUp 1s ease forwards;
        }
        .hero-actions {
          display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;
          animation: fadeUp 1.1s ease forwards;
          margin-bottom: 80px;
        }
        .btn-primary-lg {
          background: var(--gold);
          color: var(--navy);
          padding: 15px 36px;
          border-radius: 4px;
          font-size: 15px; font-weight: 700;
          text-decoration: none;
          letter-spacing: 0.04em;
          transition: all 0.2s;
          display: inline-block;
        }
        .btn-primary-lg:hover { background: var(--gold-light); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(201,168,76,0.35); }
        .btn-outline-lg {
          background: transparent;
          color: var(--white);
          padding: 15px 36px;
          border-radius: 4px;
          font-size: 15px; font-weight: 600;
          text-decoration: none;
          letter-spacing: 0.04em;
          border: 1px solid rgba(255,255,255,0.25);
          transition: all 0.2s;
          display: inline-block;
        }
        .btn-outline-lg:hover { border-color: var(--gold); color: var(--gold); }

        /* STATS BAR */
        .stats-bar {
          display: flex; gap: 0; justify-content: center;
          border: 1px solid rgba(201,168,76,0.2);
          border-radius: 8px;
          overflow: hidden;
          animation: fadeUp 1.2s ease forwards;
          max-width: 640px; width: 100%;
        }
        .stat-item {
          flex: 1;
          padding: 24px 20px;
          text-align: center;
          border-right: 1px solid rgba(201,168,76,0.15);
          background: rgba(255,255,255,0.03);
        }
        .stat-item:last-child { border-right: none; }
        .stat-number { font-family: 'Playfair Display', serif; font-size: 36px; font-weight: 700; color: var(--gold); line-height: 1; margin-bottom: 6px; }
        .stat-label { font-size: 12px; color: rgba(255,255,255,0.45); letter-spacing: 0.08em; text-transform: uppercase; font-weight: 500; }

        /* DIVIDER */
        .section-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--cream-dark), transparent);
          margin: 0;
        }

        /* TRUSTED */
        .trusted {
          background: var(--cream);
          padding: 40px 5%;
          text-align: center;
        }
        .trusted-label { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-light); font-weight: 600; margin-bottom: 24px; }
        .trusted-logos { display: flex; gap: 48px; justify-content: center; align-items: center; flex-wrap: wrap; }
        .trusted-logo { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: var(--text-mid); opacity: 0.6; letter-spacing: 0.02em; }

        /* POPULAR COURSES */
        .popular {
          background: linear-gradient(180deg, #f8f3ea 0%, #ffffff 100%);
          padding: 90px 5%;
        }
        .popular-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
          max-width: 1120px;
          margin: 0 auto;
        }
        .popular-card {
          border: 1px solid #e7dcc8;
          border-radius: 12px;
          overflow: hidden;
          background: #ffffff;
          box-shadow: 0 4px 18px rgba(17, 34, 64, 0.06);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .popular-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 24px rgba(17, 34, 64, 0.12);
        }
        .popular-cover {
          height: 170px;
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          background-color: #d9c79a;
          position: relative;
        }
        .popular-rank {
          position: absolute;
          top: 12px;
          left: 12px;
          background: rgba(10, 22, 40, 0.88);
          color: #f6df9f;
          border: 1px solid rgba(232, 201, 122, 0.4);
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
        }
        .popular-content {
          padding: 18px;
        }
        .popular-title {
          font-family: 'Playfair Display', serif;
          font-size: 22px;
          color: var(--navy);
          line-height: 1.25;
          margin-bottom: 10px;
        }
        .popular-meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }
        .popular-chip {
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-weight: 700;
          border-radius: 999px;
          padding: 4px 10px;
        }
        .popular-chip.category {
          background: #e9f0ff;
          color: #244a85;
        }
        .popular-chip.level {
          background: #f3ebd5;
          color: #7a5c12;
        }
        .popular-desc {
          color: #596679;
          font-size: 14px;
          line-height: 1.7;
          min-height: 68px;
          margin-bottom: 14px;
        }
        .popular-stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 14px;
        }
        .popular-stat {
          background: #f7f6f3;
          border: 1px solid #ece5d5;
          border-radius: 8px;
          padding: 9px 10px;
        }
        .popular-stat-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #74808f;
          margin-bottom: 3px;
        }
        .popular-stat-value {
          font-size: 15px;
          color: #12233f;
          font-weight: 700;
        }
        .popular-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }
        .popular-price {
          font-family: 'DM Sans', sans-serif;
          font-size: 22px;
          font-weight: 800;
          color: #0b5e3c;
          letter-spacing: 0.01em;
        }
        .popular-btn {
          background: #102646;
          color: #fff;
          border: 1px solid #102646;
          border-radius: 6px;
          padding: 9px 14px;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
          letter-spacing: 0.04em;
          transition: all 0.2s ease;
        }
        .popular-btn:hover {
          background: #e8c97a;
          color: #102646;
          border-color: #e8c97a;
        }
        .popular-empty {
          max-width: 920px;
          margin: 0 auto;
          background: #fff;
          border: 1px dashed #cfbf93;
          border-radius: 12px;
          padding: 22px;
          text-align: center;
          color: #556173;
          font-size: 15px;
        }
        .popular-loading {
          max-width: 920px;
          margin: 0 auto;
          text-align: center;
          color: #66758a;
          font-size: 15px;
        }

        /* FEATURES */
        .features {
          background: var(--white);
          padding: 100px 5%;
        }
        .section-header { text-align: center; margin-bottom: 64px; }
        .section-eyebrow { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--gold); font-weight: 700; margin-bottom: 16px; }
        .section-title { font-family: 'Playfair Display', serif; font-size: clamp(32px, 4vw, 52px); font-weight: 700; color: var(--navy); line-height: 1.15; max-width: 600px; margin: 0 auto 20px; }
        .section-desc { font-size: 17px; color: var(--text-light); max-width: 520px; margin: 0 auto; line-height: 1.7; font-weight: 300; }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2px;
          max-width: 1100px; margin: 0 auto;
          background: var(--cream-dark);
          border: 1px solid var(--cream-dark);
          border-radius: 12px;
          overflow: hidden;
        }
        .feature-card {
          background: var(--white);
          padding: 40px 36px;
          transition: background 0.2s;
        }
        .feature-card:hover { background: var(--cream); }
        .feature-icon { font-size: 32px; margin-bottom: 20px; display: block; }
        .feature-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: var(--navy); margin-bottom: 12px; line-height: 1.3; }
        .feature-desc { font-size: 15px; color: var(--text-light); line-height: 1.7; font-weight: 300; }

        /* HOW IT WORKS */
        .how {
          background: var(--navy);
          padding: 100px 5%;
        }
        .how .section-title { color: var(--white); }
        .how .section-desc { color: rgba(255,255,255,0.5); }
        .steps {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px;
          max-width: 1100px; margin: 0 auto;
          background: rgba(201,168,76,0.1);
          border: 1px solid rgba(201,168,76,0.1);
          border-radius: 10px; overflow: hidden;
        }
        .step {
          background: var(--navy);
          padding: 40px 32px;
          position: relative;
          transition: background 0.2s;
        }
        .step:hover { background: var(--navy-mid); }
        .step-number {
          font-family: 'Playfair Display', serif;
          font-size: 56px; font-weight: 800;
          color: rgba(201,168,76,0.15);
          line-height: 1;
          margin-bottom: 20px;
        }
        .step-title { font-size: 16px; font-weight: 700; color: var(--white); margin-bottom: 10px; }
        .step-desc { font-size: 14px; color: rgba(255,255,255,0.45); line-height: 1.65; font-weight: 300; }

        /* TESTIMONIALS */
        .testimonials {
          background: var(--cream);
          padding: 100px 5%;
        }
        .testimonials-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; max-width: 1100px; margin: 0 auto; }
        .testimonial-card {
          background: var(--white);
          border-radius: 10px;
          padding: 36px 32px;
          border: 1px solid var(--cream-dark);
          position: relative;
        }
        .testimonial-quote { font-size: 48px; color: var(--gold); font-family: 'Playfair Display', serif; line-height: 1; margin-bottom: 16px; opacity: 0.6; }
        .testimonial-text { font-size: 15px; color: var(--text-mid); line-height: 1.75; margin-bottom: 28px; font-weight: 300; font-style: italic; }
        .testimonial-author { font-size: 14px; font-weight: 700; color: var(--navy); }
        .testimonial-role { font-size: 13px; color: var(--text-light); margin-top: 2px; }

        /* CTA */
        .cta-section {
          background: var(--navy);
          padding: 100px 5%;
          text-align: center;
          position: relative; overflow: hidden;
        }
        .cta-bg {
          position: absolute; inset: 0;
          background: 
            radial-gradient(circle at 20% 50%, rgba(201,168,76,0.08) 0%, transparent 50%),
            radial-gradient(circle at 80% 50%, rgba(201,168,76,0.06) 0%, transparent 50%);
        }
        .cta-title { font-family: 'Playfair Display', serif; font-size: clamp(32px, 4vw, 56px); font-weight: 800; color: var(--white); margin-bottom: 20px; position: relative; }
        .cta-subtitle { font-size: 18px; color: rgba(255,255,255,0.55); margin-bottom: 40px; font-weight: 300; max-width: 500px; margin-left: auto; margin-right: auto; line-height: 1.7; position: relative; }
        .cta-actions { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; position: relative; }

        /* FOOTER */
        .footer {
          background: #060e1c;
          padding: 56px 5% 32px;
          border-top: 1px solid rgba(201,168,76,0.1);
        }
        .footer-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 40px; margin-bottom: 48px; flex-wrap: wrap; }
        .footer-brand { max-width: 280px; }
        .footer-logo { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: var(--white); margin-bottom: 12px; }
        .footer-logo span { color: var(--gold); }
        .footer-tagline { font-size: 14px; color: rgba(255,255,255,0.35); line-height: 1.6; font-weight: 300; }
        .footer-links { display: flex; gap: 64px; flex-wrap: wrap; }
        .footer-col-title { font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gold); margin-bottom: 16px; }
        .footer-col a { display: block; font-size: 14px; color: rgba(255,255,255,0.4); text-decoration: none; margin-bottom: 10px; transition: color 0.2s; font-weight: 300; }
        .footer-col a:hover { color: var(--white); }
        .footer-bottom { border-top: 1px solid rgba(255,255,255,0.06); padding-top: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
        .footer-copy { font-size: 13px; color: rgba(255,255,255,0.25); }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 900px) {
          .popular-grid { grid-template-columns: 1fr 1fr; }
          .features-grid { grid-template-columns: 1fr 1fr; }
          .steps { grid-template-columns: 1fr 1fr; }
          .testimonials-grid { grid-template-columns: 1fr; }
          .nav-links { display: none; }
        }
        @media (max-width: 600px) {
          .popular-grid { grid-template-columns: 1fr; }
          .features-grid { grid-template-columns: 1fr; }
          .steps { grid-template-columns: 1fr; }
          .stats-bar { flex-direction: column; }
          .stat-item { border-right: none; border-bottom: 1px solid rgba(201,168,76,0.15); }
          .stat-item:last-child { border-bottom: none; }
        }
      `}</style>

      {/* NAV */}
      <nav className={`nav ${scrolled ? "scrolled" : ""}`}>
        <div className="nav-logo display">🎓 <span>LMS</span> Pro</div>
        <div className="nav-links">
          <a href="#popular" className="nav-link">Top Courses</a>
          <a href="#features" className="nav-link">Features</a>
          <a href="#how" className="nav-link">How It Works</a>
          <a href="#testimonials" className="nav-link">Clients</a>
          <a href="/login" className="nav-link">Sign In</a>
          <a href="/org-register" className="nav-cta">Get Started</a>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-grid" />
        <div className="hero-glow" />

        <div className="hero-badge">
          ✦ Enterprise Learning Management Platform
        </div>

        <h1 className="hero-title display">
          The Professional LMS for<br />
          <span className="gold">Growing Institutions</span>
        </h1>

        <p className="hero-subtitle">
          Multi-tenant, role-based, and built for scale. Manage students, trainers, courses, payments, and analytics — all from one secure platform.
        </p>

        <div className="hero-actions">
          <a href="/org-register" className="btn-primary-lg">Register Your Organization</a>
          <a href="/login" className="btn-outline-lg">Sign In →</a>
        </div>

        <div className="stats-bar">
          <div className="stat-item">
            <div className="stat-number display">{countStudents.toLocaleString()}+</div>
            <div className="stat-label">Students Enrolled</div>
          </div>
          <div className="stat-item">
            <div className="stat-number display">{countOrgs}+</div>
            <div className="stat-label">Organizations</div>
          </div>
          <div className="stat-item">
            <div className="stat-number display">{countCourses}+</div>
            <div className="stat-label">Courses Running</div>
          </div>
        </div>
      </section>

      {/* TRUSTED */}
      <section className="trusted">
        <p className="trusted-label">Trusted by institutes across India</p>
        <div className="trusted-logos">
          {["TechLearn", "CodeCraft", "EduPro", "SkillForge", "BrightPath", "ApexAcademy"].map((name) => (
            <div key={name} className="trusted-logo">{name}</div>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      {/* POPULAR COURSES */}
      <section className="popular" id="popular">
        <div className="section-header">
          <div className="section-eyebrow">Most Enrolled</div>
          <h2 className="section-title display">Top Courses Students Choose First</h2>
          <p className="section-desc">
            Real course data from our platform, ranked by active and completed enrolments.
          </p>
        </div>

        {popularLoading ? (
          <div className="popular-loading">Loading top courses...</div>
        ) : popularCourses.length === 0 ? (
          <div className="popular-empty">
            Popular course list is not available right now. Publish courses to display them here.
          </div>
        ) : (
          <div className="popular-grid">
            {popularCourses.map((course, index) => {
              const coverUrl = resolveAssetUrl(course.thumbnailUrl || null);
              const summary = String(course.description || "").trim();
              const previewText =
                summary.length > 120 ? `${summary.slice(0, 117)}...` : summary;

              return (
                <article key={course._id} className="popular-card">
                  <div
                    className="popular-cover"
                    style={
                      coverUrl
                        ? { backgroundImage: `linear-gradient(180deg, rgba(10,22,40,0.2), rgba(10,22,40,0.55)), url(${coverUrl})` }
                        : { backgroundImage: "linear-gradient(135deg, #c9a84c, #1d3557)" }
                    }
                  >
                    <div className="popular-rank">#{index + 1} Popular</div>
                  </div>

                  <div className="popular-content">
                    <h3 className="popular-title">{course.title}</h3>

                    <div className="popular-meta">
                      {course.category && <span className="popular-chip category">{course.category}</span>}
                      {course.level && <span className="popular-chip level">{course.level}</span>}
                      {course.duration && <span className="popular-chip level">{course.duration}</span>}
                    </div>

                    <p className="popular-desc">
                      {previewText || `Trainer: ${course.trainerName || "Trainer"}`}
                    </p>

                    <div className="popular-stats">
                      <div className="popular-stat">
                        <div className="popular-stat-label">Enrolments</div>
                        <div className="popular-stat-value">{Number(course.enrolmentCount || 0).toLocaleString()}</div>
                      </div>
                      <div className="popular-stat">
                        <div className="popular-stat-label">Completion</div>
                        <div className="popular-stat-value">{Number(course.completionRate || 0).toFixed(1)}%</div>
                      </div>
                    </div>

                    <div className="popular-footer">
                      <div className="popular-price">
                        {Number(course.fee || 0) > 0
                          ? `INR ${Number(course.fee || 0).toLocaleString()}`
                          : "Free"}
                      </div>
                      <a href="/login" className="popular-btn">View Course</a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* FEATURES */}
      <section className="features" id="features">
        <div className="section-header">
          <div className="section-eyebrow">Platform Capabilities</div>
          <h2 className="section-title display">Everything Your Institution Needs</h2>
          <p className="section-desc">Built for the complete lifecycle of education management — from enrolment to certification.</p>
        </div>
        <div className="features-grid">
          {features.map((f) => (
            <div key={f.title} className="feature-card">
              <span className="feature-icon">{f.icon}</span>
              <h3 className="feature-title display">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="how" id="how">
        <div className="section-header">
          <div className="section-eyebrow" style={{ color: "var(--gold)" }}>Simple Onboarding</div>
          <h2 className="section-title display">Up and Running in Minutes</h2>
          <p className="section-desc" style={{ color: "rgba(255,255,255,0.45)" }}>No complex setup. No IT team required. Your full LMS is live the moment you register.</p>
        </div>
        <div className="steps">
          {[
            { n: "01", title: "Register Organization", desc: "Create your organization account in under 2 minutes. Your isolated environment is provisioned instantly." },
            { n: "02", title: "Add Your Team", desc: "Invite admins, trainers, and finance staff. Assign roles and permissions with a single click." },
            { n: "03", title: "Create Courses", desc: "Build your course catalog. Assign trainers, set fees, define enrolment limits, and go live." },
            { n: "04", title: "Grow & Analyse", desc: "Track every metric — revenue, enrolments, completion rates. Make decisions with real data." },
          ].map((s) => (
            <div key={s.n} className="step">
              <div className="step-number display">{s.n}</div>
              <div className="step-title">{s.title}</div>
              <div className="step-desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="testimonials" id="testimonials">
        <div className="section-header">
          <div className="section-eyebrow">Client Voices</div>
          <h2 className="section-title display">What Institutions Say</h2>
        </div>
        <div className="testimonials-grid">
          {testimonials.map((t) => (
            <div key={t.name} className="testimonial-card">
              <div className="testimonial-quote display">"</div>
              <p className="testimonial-text">{t.quote}</p>
              <div className="testimonial-author">{t.name}</div>
              <div className="testimonial-role">{t.role}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-bg" />
        <h2 className="cta-title display">Ready to Modernize<br />Your Institution?</h2>
        <p className="cta-subtitle">Join hundreds of institutes already running on LMS Pro. Free to start, scales with you.</p>
        <div className="cta-actions">
          <a href="/org-register" className="btn-primary-lg">Register for Free</a>
          <a href="/login" className="btn-outline-lg">Sign In to Dashboard</a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="footer-logo display">🎓 <span>LMS</span> Pro</div>
            <p className="footer-tagline">The professional learning management platform built for multi-tenant education institutions.</p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <div className="footer-col-title">Platform</div>
              <a href="#features">Features</a>
              <a href="#how">How It Works</a>
              <a href="/org-register">Register</a>
              <a href="/login">Sign In</a>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Roles</div>
              <a href="#">For Admins</a>
              <a href="#">For Trainers</a>
              <a href="#">For Students</a>
              <a href="#">For Finance</a>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Company</div>
              <a href="#">About</a>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
              <a href="#">Contact</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-copy">© {new Date().getFullYear()} LMS Pro. All rights reserved.</div>
          <div className="footer-copy">Built for Indian Educational Institutions</div>
        </div>
      </footer>
    </>
  );
}
