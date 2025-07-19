// llm-service.ts
export type LLMProvider = 'deepseek' | 'openai' | 'anthropic' | 'perplexity';

export type LLMModel = 
  // DeepSeek models
  | 'deepseek-chat'
  | 'deepseek-coder'
  // OpenAI models
  | 'gpt-4o'
  | 'gpt-4-turbo'
  // Anthropic models
  | 'claude-3-7-sonnet-20250219'
  | 'claude-3-opus'
  // Perplexity models 
  | 'llama-3.1-sonar-small-128k-online'
  | 'llama-3.1-sonar-large-128k-online'
  | 'llama-3.1-sonar-huge-128k-online';

export type GradingDepth = 'short' | 'medium' | 'long';

// Academic level of students being graded
export type GradeLevel = 
  | "elementary_early" // K-2
  | "elementary_mid" // 3-5
  | "middle_school" // 6-8
  | "high_school_regular" // 9-12 Regular
  | "high_school_remedial" // 9-12 Remedial
  | "high_school_honors" // 9-12 Honors/AP
  | "high_school_gifted" // 9-12 Gifted
  | "community_college" // Community College
  | "undergraduate_remedial" // Undergraduate Remedial
  | "undergraduate_regular" // Undergraduate Regular
  | "undergraduate_honors" // Undergraduate Honors
  | "masters" // Masters Level
  | "doctoral" // PhD/Doctoral Level
  | "professional" // Professional School (Law, Med, etc.)
  | "custom"; // Custom Level (allows for special cases)

export interface LLMGradingRequest {
  provider: LLMProvider;
  model: LLMModel;
  temperature: number;
  assignmentText: string;
  gradingText: string; 
  studentText: string;
  gradingDepth?: GradingDepth;
  includeCharts?: boolean;
  gradeLevel?: GradeLevel;
}

export interface LLMExemplarRequest {
  provider: LLMProvider;
  model: LLMModel;
  temperature: number;
  assignmentText: string;
  referenceText: string;
  instructionsText: string;
  includeAnnotations: boolean;
}

// Generate a grading prompt for the LLM
export function generateGradingPrompt(request: LLMGradingRequest): string {
  // Define depth-specific instructions
  let depthInstructions = '';
  switch (request.gradingDepth) {
    case 'short':
      depthInstructions = `
## Feedback Depth: SHORT
Provide a concise assessment (200-300 words) with NO direct quotes from the student's work. Focus on summarizing key strengths and weaknesses.`;
      break;
    case 'medium':
      depthInstructions = `
## Feedback Depth: MEDIUM
Provide a moderate-length assessment (400-600 words) with SOME direct quotes from student's work to illustrate key points. Include specific examples to support your evaluation.`;
      break;
    case 'long':
      depthInstructions = `
## Feedback Depth: LONG
Provide a comprehensive assessment (800-1200 words) with EXTENSIVE direct quotes from the student's work. Thoroughly analyze all aspects of the submission with detailed examples.`;
      break;
    default:
      // Default to medium if not specified
      depthInstructions = `
## Feedback Depth: MEDIUM
Provide a moderate-length assessment (400-600 words) with SOME direct quotes from student's work to illustrate key points. Include specific examples to support your evaluation.`;
  }

  // Grade level-specific instructions
  let gradeLevelInstructions = '';
  if (request.gradeLevel) {
    switch (request.gradeLevel) {
      case 'elementary_early':
        gradeLevelInstructions = `
## Academic Level: ELEMENTARY SCHOOL (K-2)
You are grading work from very young students (K-2nd grade). Use simple, encouraging language with a focus on foundational skills. Heavily praise effort and creativity. Avoid complex terminology. Feedback should be primarily positive with gentle suggestions for improvement. Expectations should be appropriate for early literacy and numeracy development.`;
        break;
      case 'elementary_mid':
        gradeLevelInstructions = `
## Academic Level: ELEMENTARY SCHOOL (3-5)
You are grading work from elementary school students (3rd-5th grade). Use clear, supportive language focusing on developing skills. Balance encouragement with constructive feedback. Use straightforward terminology. Expectations should focus on grade-appropriate skills like basic paragraph structure, reading comprehension, and developing critical thinking.`;
        break;
      case 'middle_school':
        gradeLevelInstructions = `
## Academic Level: MIDDLE SCHOOL (6-8)
You are grading work from middle school students (6th-8th grade). Use age-appropriate language that acknowledges developing academic abilities. Provide specific feedback on organization, content, and critical thinking skills. Balance positive reinforcement with clear areas for improvement. Expectations should focus on developing argumentation, evidence usage, and analytical skills.`;
        break;
      case 'high_school_remedial':
        gradeLevelInstructions = `
## Academic Level: HIGH SCHOOL - REMEDIAL
You are grading work from high school students in remedial classes who may struggle with grade-level content. Focus feedback on building confidence while developing fundamental skills. Use accessible language and explicit instruction. Highlight progress and growth. Expectations should prioritize developing core competencies with scaffolded support.`;
        break;
      case 'high_school_regular':
        gradeLevelInstructions = `
## Academic Level: HIGH SCHOOL - STANDARD
You are grading work from typical high school students. Use age-appropriate academic language. Provide balanced feedback on content mastery, organization, and critical thinking. Expectations should focus on grade-level competencies including thesis development, evidence-based arguments, and analytical reasoning.`;
        break;
      case 'high_school_honors':
        gradeLevelInstructions = `
## Academic Level: HIGH SCHOOL - HONORS/AP
You are grading work from advanced high school students in honors or AP courses. Use sophisticated academic language. Provide rigorous feedback on higher-order thinking skills. Expectations should be elevated, focusing on college-preparatory skills including advanced argumentation, synthesis of complex ideas, and independent analysis.`;
        break;
      case 'high_school_gifted':
        gradeLevelInstructions = `
## Academic Level: HIGH SCHOOL - GIFTED
You are grading work from exceptionally talented high school students. Use sophisticated, college-level academic language. Provide challenging, in-depth feedback that pushes boundaries of thought. Expectations should be set at undergraduate level, focusing on original thinking, nuanced analysis, sophisticated argumentation, and potential for publication-quality work.`;
        break;
      case 'community_college':
        gradeLevelInstructions = `
## Academic Level: COMMUNITY COLLEGE
You are grading work from community college students with diverse academic backgrounds. Use clear, straightforward academic language. Provide supportive yet rigorous feedback balanced with acknowledgment of practical applications. Expectations should focus on developing undergraduate-level academic skills while addressing varying levels of prior preparation.`;
        break;
      case 'undergraduate_remedial':
        gradeLevelInstructions = `
## Academic Level: UNDERGRADUATE - REMEDIAL
You are grading work from college students in remedial courses who need additional support. Use accessible academic language while gradually introducing more advanced terminology. Provide detailed, supportive feedback focused on building fundamental skills. Expectations should focus on bridging gaps in preparation while developing college-level competencies.`;
        break;
      case 'undergraduate_regular':
        gradeLevelInstructions = `
## Academic Level: UNDERGRADUATE - STANDARD
You are grading work from typical undergraduate students. Use standard academic language and discipline-specific terminology. Provide balanced feedback on content mastery, critical analysis, and scholarly conventions. Expectations should align with undergraduate standards including argument development, research skills, theoretical understanding, and disciplinary methodologies.`;
        break;
      case 'undergraduate_honors':
        gradeLevelInstructions = `
## Academic Level: UNDERGRADUATE - HONORS
You are grading work from high-achieving undergraduate students in honors programs. Use sophisticated academic language with discipline-specific terminology. Provide rigorous feedback that challenges students to exceed standard expectations. Expectations should approach graduate level, focusing on original analysis, research potential, theoretical sophistication, and scholarly contribution.`;
        break;
      case 'masters':
        gradeLevelInstructions = `
## Academic Level: GRADUATE - MASTERS
You are grading work from graduate students in master's programs. Use advanced academic language with specialized discipline terminology. Provide detailed, scholarly feedback on advanced concepts, methodologies, and theoretical frameworks. Expectations should focus on specialized knowledge, professional competencies, sophisticated research methods, and potential for field contribution.`;
        break;
      case 'doctoral':
        gradeLevelInstructions = `
## Academic Level: GRADUATE - PHD/DOCTORAL
You are grading work from doctoral students. Use expert-level academic language with specialized terminology. Provide rigorous feedback at the highest scholarly standards. Expectations should focus on original contribution to the field, theoretical innovation, methodological sophistication, and publication-ready quality. Feedback should prepare students for scholarly discourse and academic careers.`;
        break;
      case 'professional':
        gradeLevelInstructions = `
## Academic Level: PROFESSIONAL SCHOOL
You are grading work from students in professional schools (law, medicine, business, etc.). Use industry-standard terminology and concepts. Provide feedback focused on both theoretical understanding and practical application. Expectations should emphasize professional standards, ethical considerations, applied problem-solving, and field-specific requirements.`;
        break;
      case 'custom':
        // For custom, we don't add specific instructions as the teacher should provide these in the gradingText
        break;
    }
  }

  // Charts instructions
  const chartsInstructions = request.includeCharts ? `
## Chart Requirements
Your response MUST include data for visualizing the following metrics as charts:
1. Category scores - Provide a breakdown of scores across 4-6 key assessment categories (e.g., Content, Organization, Critical Thinking, etc.)
2. Strengths/Weaknesses ratio - Quantify the ratio of strengths to weaknesses
3. Overall quality rating - Provide a percentage score for overall quality

Format this data in a JSON structure at the end of your response, like this:
\`\`\`json
{
  "categoryScores": [
    {"category": "Content", "score": 85},
    {"category": "Organization", "score": 92},
    {"category": "Critical Thinking", "score": 78},
    {"category": "References", "score": 88},
    {"category": "Writing Quality", "score": 90}
  ],
  "strengthsWeaknesses": {
    "strengths": 70,
    "weaknesses": 30
  },
  "overallQuality": 85
}
\`\`\`
` : '';

  return `
You are a professor's grading assistant. Please grade the following student submission based on the assignment prompt and grading instructions.
${gradeLevelInstructions}

## Assignment Prompt:
${request.assignmentText}

## Grading Instructions:
${request.gradingText}

## Student Submission:
${request.studentText}
${depthInstructions}
${chartsInstructions}
IMPORTANT: You MUST return a numerical score as the first line in the format 'GRADE: XX/YY' where XX is the points earned and YY is the total possible points. For example: 'GRADE: 45/50'. Do NOT include additional text, descriptions, or explanations with the grade - just the score itself.

Please provide a well-structured evaluation including the specified grade format and depth of feedback. Your response will be delivered directly to the professor, so ensure it is clear and professional.`;
}

// Generate an exemplar prompt for the LLM
export function generateExemplarPrompt(request: LLMExemplarRequest): string {
  const annotationsInstructions = request.includeAnnotations 
    ? "Please include annotations explaining why specific elements make this an exemplary submission."
    : "";
  
  return `
You are a professor's exemplar generator. Please create a model example of a successful assignment submission based on the following information.

## Assignment Prompt:
${request.assignmentText}

## Reference Materials:
${request.referenceText || "No additional reference materials provided."}

## Specific Instructions:
${request.instructionsText}

${annotationsInstructions}

Please create an exemplary submission that would receive the highest possible grade. Your response will be delivered directly to the professor without any formatting or processing, so please ensure it is well-structured and clear.`;
}
