/**
 * Test Brief Fixtures — 3 Mock Approved Briefs
 *
 * Realistic sales brief data for Financial Services, Healthcare,
 * and Technology industries. Used by verify-rag-quality.ts to test
 * the multi-pass retrieval pipeline against diverse industry profiles.
 */

import type { SalesBrief } from "@lumenalta/schemas";

export const TEST_BRIEFS: SalesBrief[] = [
  // ── Financial Services - Digital Banking ──
  {
    companyName: "Meridian Federal Credit Union",
    industry: "Financial Services & Insurance",
    subsector: "Digital Banking",
    primaryPillar: "Platform & Application Development",
    secondaryPillars: ["Data Modernization"],
    evidence:
      "Customer explicitly mentioned mobile banking modernization and data analytics needs",
    customerContext:
      "Meridian FCU is a mid-size credit union with 250K members. Their mobile banking platform is 8 years old, built on a legacy .NET monolith. Members are leaving for fintech competitors with better digital experiences.",
    businessOutcomes:
      "Reduce mobile app abandonment by 40%, increase digital account openings by 60%, consolidate 3 data warehouses into a single analytics platform",
    constraints:
      "NCUA regulatory compliance, $2.5M budget ceiling, must maintain 99.99% uptime during migration",
    stakeholders:
      "CIO Sarah Chen (sponsor), VP Digital Banking Mike Torres (decision maker), CISO Rachel Kim (security gate)",
    timeline:
      "Phase 1 MVP in 6 months, full platform in 18 months",
    budget:
      "$2.5M over 18 months, phased investment with Q1 2027 board approval",
    useCases: [
      {
        name: "Mobile Banking Modernization",
        description:
          "Rebuild mobile banking on cloud-native architecture with real-time transaction processing",
        roiOutcome: "Reduce mobile app abandonment by 40%",
        valueHypothesis:
          "Lumenalta's agile pod model delivers iterative releases every 2 weeks, proving value before full commitment",
      },
      {
        name: "Data Analytics Platform",
        description:
          "Consolidate 3 legacy data warehouses into unified analytics platform for member insights",
        roiOutcome: "Reduce data reconciliation effort by 60%",
        valueHypothesis:
          "Lumenalta's data modernization practice has migrated 12 financial services clients to cloud-native data platforms",
      },
    ],
  },

  // ── Healthcare - Telehealth ──
  {
    companyName: "Pacific Health Partners",
    industry: "Health Care",
    subsector: "Telehealth",
    primaryPillar: "AI, ML & LLM",
    secondaryPillars: ["Cloud & Infrastructure"],
    evidence:
      "Customer discussed AI triage and cloud migration repeatedly",
    customerContext:
      "Pacific Health Partners operates 15 clinics across 3 states. Post-COVID telehealth volume has plateaued at 30% of visits. Current telehealth platform has no AI capabilities. Clinicians spend 15 minutes per patient on pre-visit triage.",
    businessOutcomes:
      "Reduce pre-visit triage time from 15 to 3 minutes, increase telehealth adoption to 50% of visits, improve patient satisfaction scores by 20 points",
    constraints:
      "HIPAA compliance mandatory, must integrate with Epic EHR, limited IT staff (team of 8)",
    stakeholders:
      "CMO Dr. James Park (sponsor), VP IT Linda Morales (technical lead), COO David Wu (budget authority)",
    timeline: "Pilot in 3 months, full rollout in 12 months",
    budget: "$1.8M budget, with $500K allocated for pilot phase",
    useCases: [
      {
        name: "AI-Powered Patient Triage",
        description:
          "Implement ML-based symptom assessment and routing for telehealth visits",
        roiOutcome:
          "Reduce clinician triage time from 15 to 3 minutes per patient",
        valueHypothesis:
          "Lumenalta's healthcare AI practice has deployed 5 clinical decision support systems with HIPAA compliance built in",
      },
      {
        name: "Cloud Infrastructure Migration",
        description:
          "Migrate telehealth platform to HIPAA-compliant cloud infrastructure for scalability",
        roiOutcome:
          "Reduce infrastructure costs by 35% while supporting 2x concurrent sessions",
        valueHypothesis:
          "Lumenalta's cloud practice specializes in healthcare workloads with built-in compliance guardrails",
      },
    ],
  },

  // ── Technology - Enterprise Software ──
  {
    companyName: "NovaTech Solutions",
    industry: "Technology, Media & Telecommunications",
    subsector: "Enterprise Software",
    primaryPillar: "Cloud & Infrastructure",
    secondaryPillars: ["Platform & Application Development"],
    evidence:
      "Customer focused on cloud-native architecture and developer platform improvements",
    customerContext:
      "NovaTech is a B2B SaaS company with 500 enterprise customers. Their monolithic application struggles with multi-tenancy at scale. Deployment cycles take 2 weeks. Engineering team of 120 developers.",
    businessOutcomes:
      "Reduce deployment cycle from 2 weeks to daily, achieve 99.99% multi-tenant SLA, decrease customer onboarding time from 4 weeks to 3 days",
    constraints:
      "SOC 2 Type II compliance, zero-downtime migration required, 120 developers must be trained on new architecture",
    stakeholders:
      "CTO Alex Rivera (sponsor), VP Engineering Priya Sharma (technical lead), VP Product Mark Johnson (feature priorities)",
    timeline:
      "Architecture design in 2 months, migration complete in 12 months",
    budget: "$3.5M, with exec approval secured for Phase 1",
    useCases: [
      {
        name: "Cloud-Native Architecture",
        description:
          "Decompose monolith into microservices with Kubernetes-based multi-tenant infrastructure",
        roiOutcome:
          "Achieve 99.99% SLA with 3x lower infrastructure cost per customer",
        valueHypothesis:
          "Lumenalta's cloud architecture practice has migrated 8 SaaS platforms from monolith to microservices",
      },
      {
        name: "Developer Platform",
        description:
          "Build internal developer platform with CI/CD, observability, and self-service infrastructure provisioning",
        roiOutcome:
          "Reduce deployment cycle from 2 weeks to daily releases",
        valueHypothesis:
          "Lumenalta's platform engineering teams embed with client developers to transfer ownership",
      },
    ],
  },
];
