# 📊 Chart Factory: The Reusable Pattern Guide

## 🎯 The 4-Layer Architecture

Every chart follows the same pattern. Change these 4 layers to create any visualization:

### Layer 1: Data Interface (The Contract)
```typescript
// CURRENT: Relationship data
interface ChartDataPoint {
  month: string;      // X-axis value
  scale: number;      // Y-axis value  
  notes?: string;     // Optional metadata
}

// EXAMPLE: Sales data
interface SalesDataPoint {
  quarter: string;    // X-axis value
  revenue: number;    // Y-axis value
  target?: number;    // Optional comparison
}

// EXAMPLE: Fitness data  
interface FitnessDataPoint {
  week: string;       // X-axis value
  weight: number;     // Y-axis value
  bodyFat?: number;   // Optional secondary metric
}
```

### Layer 2: API Endpoint (The Data Pipeline)
```typescript
// PATTERN: /api/[dataset-name]/route.ts

// CURRENT: /api/relationship-tracker/route.ts
const query = `
  SELECT id, date, scale, notes
  FROM relationship_tracker 
  ORDER BY date ASC
`;

// NEW: /api/sales-data/route.ts  
const query = `
  SELECT id, quarter, revenue, target
  FROM sales_performance
  ORDER BY quarter ASC
`;

// NEW: /api/fitness-progress/route.ts
const query = `
  SELECT id, date, weight, body_fat_percentage
  FROM fitness_tracking
  ORDER BY date ASC
`;
```

### Layer 3: Chart Component (The Visualization)
```typescript
// CURRENT: ChartAreaInteractive
// NEW: SalesChartArea, FitnessChartArea, etc.

// Just change these key properties:
const chartConfig = {
  scale: {                    // ← Change this key
    label: "Relationship Scale", // ← Change this label
    color: "var(--primary)",
  },
} satisfies ChartConfig

// And the data transformation:
<Area
  dataKey="scale"           // ← Change to your Y-axis field
  type="monotone"
  fill="url(#fillScale)"
  stroke="var(--color-scale)"
  strokeWidth={2}
/>
```

### Layer 4: Page Integration (The Assembly)
```typescript
// CURRENT: Fetches relationship data
useEffect(() => {
  async function fetchRelationshipData() {
    const response = await fetch('/api/relationship-tracker'); // ← Change endpoint
    // ... rest stays the same
  }
}, []);
```

---

## 🔧 The Copy-Paste Transformation Guide

### Step 1: Clone the API Route
```bash
# Copy the file
cp /api/relationship-tracker/route.ts /api/[NEW-DATASET]/route.ts

# Update these 4 lines:
1. Database table name in SQL query
2. Interface definition for your data structure  
3. Data transformation logic (grouping/aggregation)
4. Response field names
```

### Step 2: Clone the Chart Component
```bash
# Copy the component
cp chart-area-interactive.tsx [new-chart-name].tsx

# Update these 5 elements:
1. Interface name and fields
2. chartConfig object (dataKey and label)
3. <Area dataKey="YOUR_FIELD" />
4. Tooltip formatter labels
5. Component name and description
```

### Step 3: Update Page Integration
```typescript
// Just change the fetch URL and state variable names
const [salesData, setSalesData] = useState<SalesDataPoint[]>([]);

useEffect(() => {
  fetch('/api/sales-data')  // ← New endpoint
    .then(res => res.json())
    .then(data => setSalesData(data)); // ← New setter
}, []);
```

---

## 🎨 Real Examples: 3 Different Charts

### Example 1: Sales Performance Chart
```typescript
// Interface
interface SalesDataPoint {
  quarter: string;
  revenue: number;
  target?: number;
}

// API Query  
SELECT quarter, SUM(revenue) as revenue, AVG(target) as target
FROM sales_data 
GROUP BY quarter 
ORDER BY quarter ASC

// Chart Config
const chartConfig = {
  revenue: {
    label: "Revenue ($)",
    color: "hsl(var(--chart-1))",
  },
}

// Area Component
<Area dataKey="revenue" ... />
```

### Example 2: Website Traffic Chart
```typescript
// Interface
interface TrafficDataPoint {
  month: string;
  visitors: number;
  pageViews?: number;
}

// API Query
SELECT 
  DATE_FORMAT(date, '%b %Y') as month,
  SUM(unique_visitors) as visitors,
  SUM(page_views) as pageViews
FROM analytics_data 
GROUP BY month
ORDER BY date ASC

// Chart Config
const chartConfig = {
  visitors: {
    label: "Monthly Visitors",
    color: "hsl(var(--chart-2))",
  },
}

// Area Component  
<Area dataKey="visitors" ... />
```

### Example 3: Fitness Progress Chart
```typescript
// Interface
interface FitnessDataPoint {
  week: string;
  weight: number;
  muscle?: number;
}

// API Query
SELECT 
  WEEK(date) as week,
  AVG(weight) as weight,
  AVG(muscle_mass) as muscle
FROM fitness_tracking
GROUP BY week
ORDER BY date ASC

// Chart Config
const chartConfig = {
  weight: {
    label: "Weight (lbs)",
    color: "hsl(var(--chart-3))",
  },
}

// Area Component
<Area dataKey="weight" ... />
```

---

## 🚀 The Universal Chart Template

### Generic Reusable Component
```typescript
interface GenericChartProps<T> {
  data?: T[];
  loading?: boolean;
  error?: string;
  config: {
    title: string;
    description: string;
    dataKey: keyof T;
    label: string;
    yAxisDomain?: [number, number];
  };
}

export function UniversalAreaChart<T>({ 
  data, 
  loading, 
  error, 
  config 
}: GenericChartProps<T>) {
  // Same logic, but config-driven!
}
```

### Usage
```typescript
// Relationship Chart
<UniversalAreaChart 
  data={relationshipData}
  config={{
    title: "Relationship Progress",
    description: "Monthly relationship scale",
    dataKey: "scale",
    label: "Relationship Scale",
    yAxisDomain: [0, 10]
  }}
/>

// Sales Chart  
<UniversalAreaChart 
  data={salesData}
  config={{
    title: "Sales Performance", 
    description: "Quarterly revenue tracking",
    dataKey: "revenue",
    label: "Revenue ($)",
    yAxisDomain: [0, 1000000]
  }}
/>
```

---

## 💡 Pro Tips for Chart Cloning

### Data Transformation Patterns
```typescript
// PATTERN 1: Time-based grouping (most common)
// Group daily data into weeks/months/quarters

// PATTERN 2: Category aggregation  
// Sum/average by category, department, etc.

// PATTERN 3: Running totals
// Cumulative sums over time

// PATTERN 4: Ratio calculations
// Conversion rates, growth percentages, etc.
```

### Quick Wins for Any Dataset
1. **Always include trend analysis** (improving/declining/stable)
2. **Add empty state handling** for new datasets
3. **Include data point counts** in the footer
4. **Use consistent color schemes** across charts
5. **Add export functionality** for stakeholder reports

---

## 🎯 The 15-Minute Chart Challenge

With this pattern, you should be able to create a new chart in **15 minutes**:

- **5 min**: Clone and update API route
- **5 min**: Clone and customize chart component  
- **5 min**: Integrate into page and test

**The secret**: Don't overthink it. Change the data source, update the field names, adjust the labels. The visualization logic stays 95% identical.

Want me to build you a chart generator script that automates this entire process?