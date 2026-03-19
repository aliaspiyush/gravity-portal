import { GoogleGenAI } from "@google/genai";

// API key injected at build time via vite.config.ts (process.env.GEMINI_API_KEY)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface DashboardSpec {
  status: "success" | "needs_clarification" | "cannot_answer";
  natural_language_understanding: {
    primary_intent: string;
    business_question: string;
    time_scope: string | null;
    segment_dimensions: string[];
    metrics: string[];
  };
  data_plan: {
    requires_new_query: boolean;
    sql_queries: {
      id: string;
      description: string;
      sql: string;
      expected_result_shape: string;
    }[];
    assumptions: string[];
    clarification_questions: string[];
  };
  visualization_plan: {
    charts: {
      id: string;
      title: string;
      query_id: string;
      recommended_chart_type: "line" | "bar" | "stacked_bar" | "pie" | "donut" | "area" | "table" | "KPI";
      x_field: string | null;
      y_field: string | null;
      series_field: string | null;
      filters: { field: string; operator: string; value: any; }[];
      interactions: any;
      rationale: string;
    }[];
    layout: {
      type: string;
      rows: number;
      columns: number;
      positions: {
        chart_id: string;
        row: number;
        column: number;
        row_span: number;
        column_span: number;
      }[];
    };
  };
  follow_up_suggestions: string[];
  explanation: string;
}

export async function generateDashboardSpec(
  userQuery: string,
  dbSchema: string,
  context: any
): Promise<DashboardSpec> {
  const prompt = `
You are an assistant for non-technical business executives (CXOs) that converts natural language questions into interactive business intelligence dashboards in real time.

Your core objective is to take a plain-English request, infer the analytical intent, generate the correct data queries, choose appropriate visualizations, and return a structured dashboard specification for the frontend to render.

1. High-level behavior
Communicate in clear, concise business language suitable for CXOs.
Never expose internal reasoning text to the user; only return final results in the specified JSON schema.
If the data needed to answer a query does not exist in the provided schema/context, explicitly say so in the explanation field and avoid making up numbers.
Support follow-up questions that modify or filter the current dashboard (chat-with-the-dashboard behavior).

2. Inputs you will receive
{
  "user_query": "${userQuery.replace(/"/g, '\\"')}",
  "db_schema": "${dbSchema.replace(/"/g, '\\"')}",
  "context": ${JSON.stringify(context)}
}

3. Output format (MUST FOLLOW STRICTLY)
Always respond with a single JSON object that follows this schema exactly:
{
  "status": "success | needs_clarification | cannot_answer",
  "natural_language_understanding": {
    "primary_intent": "<e.g., trend_analysis, comparison, breakdown, ranking, correlation>",
    "business_question": "<short paraphrase of what the user wants>",
    "time_scope": "<parsed time range or null>",
    "segment_dimensions": ["<dim1>", "<dim2>"],
    "metrics": ["<metric1>", "<metric2>"]
  },
  "data_plan": {
    "requires_new_query": true,
    "sql_queries": [
      {
        "id": "q1",
        "description": "<purpose of this query>",
        "sql": "<valid SQL using db_schema, no placeholders>",
        "expected_result_shape": "<e.g., time_series, category_breakdown, pivot_table>"
      }
    ],
    "assumptions": ["<any assumption about time ranges, default filters, currency, etc.>"],
    "clarification_questions": ["<only if status == 'needs_clarification'>"]
  },
  "visualization_plan": {
    "charts": [
      {
        "id": "chart_1",
        "title": "<chart title>",
        "query_id": "q1",
        "recommended_chart_type": "line | bar | stacked_bar | pie | donut | area | table | KPI",
        "x_field": "<column_from_query_result_or_null>",
        "y_field": "<column_from_query_result_or_null>",
        "series_field": "<optional series/split-by column>",
        "filters": [],
        "interactions": { "tooltip": true, "zoom": true, "brush": false, "cross_filter": true },
        "rationale": "<1-2 sentences explaining why this chart type is appropriate>"
      }
    ],
    "layout": {
      "type": "grid",
      "rows": 2,
      "columns": 2,
      "positions": [
        { "chart_id": "chart_1", "row": 1, "column": 1, "row_span": 1, "column_span": 2 }
      ]
    }
  },
  "follow_up_suggestions": ["<suggested question 1>", "<suggested question 2>", "<suggested question 3>"],
  "explanation": "<brief, non-technical explanation of what this dashboard will show>"
}

4. Chart selection guidelines
Time-series metrics over dates or months -> line or area chart.
Comparing categories at a single point in time -> bar or stacked_bar.
Parts-of-a-whole with few categories -> pie or donut.
Ranking or top-N lists -> bar (sorted), plus optional KPI tiles.
Raw, detailed data inspection -> table.
Always include at least one chart when status = "success".

5. Accuracy, robustness, and hallucination control
Generate SQL only using columns and tables that exist in db_schema.
The table name is always 'data'. Use "SELECT * FROM data" as the base table.
Use standard SQL compatible with AlaSQL. Use square brackets for column names with spaces.
Never fabricate metric values, categories, or dates that are not implied by db_schema.
If the question requires data beyond the available schema, respond with status = "cannot_answer".

6. Handling follow-up "chat with the dashboard"
Interpret the new user_query as a modification unless it explicitly asks for a new dashboard.
Preserve chart IDs where possible and only adjust what is necessary.
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");
  return JSON.parse(text) as DashboardSpec;
}

export async function generateDetailedInsights(
  schema: string,
  dashboardContext: any
): Promise<string> {
  const prompt = `
You are an expert data analyst. Review the following database schema and the current dashboard context.
Provide a deep, strategic analysis of what this data might indicate, potential anomalies to look out for, and actionable business recommendations.
Be concise but highly analytical. Format your response clearly with sections.

Schema:
${schema}

Dashboard Context:
${JSON.stringify(dashboardContext, null, 2)}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
  });

  return response.text || "Could not generate insights.";
}

export async function generateWebContext(
  query: string,
  schema: string
): Promise<{ text: string; urls: string[] }> {
  const prompt = `
Based on the user's data schema, provide relevant industry context, benchmarks, and market insights that could help interpret this data.
Be specific and actionable.

Schema: ${schema}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: { tools: [{ googleSearch: {} }] },
  });

  const urls: string[] = [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
    chunks.forEach((chunk: any) => {
      if (chunk.web?.uri) urls.push(chunk.web.uri);
    });
  }

  return { text: response.text || "No context available.", urls };
}
