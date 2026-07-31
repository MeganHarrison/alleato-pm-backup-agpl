import type {
  RecruitingPrototypeState,
  RecruitingRequisition,
} from "./prototype-model";

export const RECRUITING_REQUISITIONS: RecruitingRequisition[] = [
  {
    id: "req-vp-construction",
    title: "Vice President of Construction",
    location: "Indianapolis, IN",
  },
  {
    id: "req-senior-estimator",
    title: "Senior Estimator",
    location: "Indianapolis, IN",
  },
  {
    id: "req-project-manager",
    title: "Project Manager",
    location: "Westfield, IN",
  },
];

export const INITIAL_RECRUITING_STATE: RecruitingPrototypeState = {
  candidates: [
    {
      id: "candidate-jordan",
      name: "Jordan Lee",
      email: "jordan.lee@example.test",
      phone: "(555) 010-0114",
      location: "Carmel, IN",
      currentRole: "Director of Construction",
      currentCompany: "Beacon Ridge",
      resumeFacts: [
        "18 years in commercial construction",
        "Led $120M annual project portfolio",
        "Managed preconstruction and field operations",
      ],
    },
    {
      id: "candidate-cameron",
      name: "Cameron Davis",
      email: "cameron.davis@example.test",
      phone: "(555) 010-0127",
      location: "Indianapolis, IN",
      currentRole: "Senior Project Executive",
      currentCompany: "Mason Works",
      resumeFacts: [
        "Healthcare and industrial delivery",
        "P&L responsibility across three regions",
        "OSHA 30 and LEED AP",
      ],
    },
    {
      id: "candidate-riley",
      name: "Riley Chen",
      email: "riley.chen@example.test",
      phone: "(555) 010-0138",
      location: "Fishers, IN",
      currentRole: "Preconstruction Director",
      currentCompany: "Axis Build Group",
      resumeFacts: [
        "Conceptual estimating and GMP development",
        "Built a six-person estimating team",
        "Advanced cost-modeling experience",
      ],
    },
    {
      id: "candidate-alex",
      name: "Alex Rivera",
      email: "alex.rivera@example.test",
      phone: "(555) 010-0152",
      location: "Noblesville, IN",
      currentRole: "Project Executive",
      currentCompany: "Fieldstone Partners",
      resumeFacts: [
        "Delivered complex occupied renovations",
        "Mentored project managers and superintendents",
        "Client retention program owner",
      ],
    },
    {
      id: "candidate-morgan",
      name: "Morgan Patel",
      email: "morgan.patel@example.test",
      phone: "(555) 010-0166",
      location: "Zionsville, IN",
      currentRole: "Operations Manager",
      currentCompany: "Keystone Constructors",
      resumeFacts: [
        "Operational planning across five offices",
        "Implemented project health reviews",
        "Resume requires employer-date verification",
      ],
    },
  ],
  applications: [
    {
      id: "application-jordan-vp",
      candidateId: "candidate-jordan",
      requisitionId: "req-vp-construction",
      stage: "review",
      source: "Employee referral",
      receivedAt: "2026-07-24T14:30:00.000Z",
      evidenceStatus: "Review ready",
      disposition: "Advance",
      timeline: [
        {
          id: "event-jordan-vp-2",
          at: "2026-07-25T15:00:00.000Z",
          label: "Contact details verified",
        },
        {
          id: "event-jordan-vp-1",
          at: "2026-07-24T14:30:00.000Z",
          label: "Resume received from employee referral",
        },
      ],
    },
    {
      id: "application-jordan-estimator",
      candidateId: "candidate-jordan",
      requisitionId: "req-senior-estimator",
      stage: "qualified",
      source: "Alternate-role review",
      receivedAt: "2026-07-25T16:10:00.000Z",
      evidenceStatus: "Review ready",
      disposition: "Evaluate another role",
      timeline: [
        {
          id: "event-jordan-estimator-1",
          at: "2026-07-25T16:10:00.000Z",
          label: "Linked to Senior Estimator without duplicating candidate",
        },
      ],
    },
    {
      id: "application-cameron",
      candidateId: "candidate-cameron",
      requisitionId: "req-vp-construction",
      stage: "new",
      source: "Recruiting mailbox",
      receivedAt: "2026-07-27T13:15:00.000Z",
      evidenceStatus: "Needs review",
      disposition: "Hold",
      timeline: [
        {
          id: "event-cameron-1",
          at: "2026-07-27T13:15:00.000Z",
          label: "Resume received; two fields need verification",
        },
      ],
    },
    {
      id: "application-riley",
      candidateId: "candidate-riley",
      requisitionId: "req-vp-construction",
      stage: "qualified",
      source: "Direct outreach",
      receivedAt: "2026-07-21T18:40:00.000Z",
      evidenceStatus: "Review ready",
      disposition: "Advance",
      timeline: [
        {
          id: "event-riley-2",
          at: "2026-07-23T14:00:00.000Z",
          label: "Human evidence review completed",
        },
        {
          id: "event-riley-1",
          at: "2026-07-21T18:40:00.000Z",
          label: "Candidate added from direct outreach",
        },
      ],
    },
    {
      id: "application-alex",
      candidateId: "candidate-alex",
      requisitionId: "req-vp-construction",
      stage: "interview",
      source: "Industry referral",
      receivedAt: "2026-07-18T12:20:00.000Z",
      evidenceStatus: "Review ready",
      disposition: "Advance",
      timeline: [
        {
          id: "event-alex-2",
          at: "2026-07-25T17:30:00.000Z",
          label: "Leadership interview requested",
        },
        {
          id: "event-alex-1",
          at: "2026-07-18T12:20:00.000Z",
          label: "Resume received from industry referral",
        },
      ],
    },
    {
      id: "application-morgan",
      candidateId: "candidate-morgan",
      requisitionId: "req-vp-construction",
      stage: "offer",
      source: "Agency",
      receivedAt: "2026-07-15T11:05:00.000Z",
      evidenceStatus: "Needs review",
      disposition: "Hold",
      timeline: [
        {
          id: "event-morgan-2",
          at: "2026-07-26T19:15:00.000Z",
          label: "Offer review paused for employment-date verification",
        },
        {
          id: "event-morgan-1",
          at: "2026-07-15T11:05:00.000Z",
          label: "Agency resume received",
        },
      ],
    },
  ],
};
