import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Download, Upload, Wand2, FileText, LogIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

// LLM Provider options for AI Text Rewriter
const LLM_PROVIDERS = [
  { value: "anthropic", label: "SHEN 1" },
  { value: "openai", label: "SHEN 2" },
  { value: "deepseek", label: "SHEN 3" },
  { value: "perplexity", label: "SHEN 4" },
];

// Style samples categorized as specified
const STYLE_SAMPLES = {
  "CONTENT-NEUTRAL": [
    {
      title: "FORMAL AND FUNCTIONAL RELATIONSHIPS",
      content: `There are two broad types of relationships: formal and functional.
Formal relationships hold between descriptions. A description is any statement that can be true or false.
Example of a formal relationship: The description that a shape is a square cannot be true unless the description that it has four equal sides is true. Therefore, a shape's being a square depends on its having four equal sides.

Functional relationships hold between events or conditions. (An event is anything that happens in time.)
Example of a functional relationship: A plant cannot grow without water. Therefore, a plant's growth depends on its receiving water.

The first type is structural, i.e., it holds between statements about features.
The second is operational, i.e., it holds between things in the world as they act or change.

Descriptions as objects of consideration
The objects of evaluation are descriptions. Something is not evaluated unless it is described, and it is not described unless it can be stated. One can notice non-descriptions — sounds, objects, movements — but in the relevant sense one evaluates descriptions of them.

Relationships not known through direct observation
Some relationships are known, not through direct observation, but through reasoning. Such relationships are structural, as opposed to observational. Examples of structural relationships are:

If A, then A or B.

All tools require some form of use.

Nothing can be both moving and perfectly still.

There are no rules without conditions.

1 obviously expresses a relationship; 2–4 do so less obviously, as their meanings are:

2*. A tool's being functional depends on its being usable.
3*. An object's being both moving and still depends on contradictory conditions, which cannot occur together.
4*. The existence of rules depends on the existence of conditions to which they apply.

Structural truth and structural understanding
Structural understanding is always understanding of relationships. Observational understanding can be either direct or indirect; the same is true of structural understanding.`
    },
    {
      title: "ALTERNATIVE ACCOUNT OF EXPLANATORY EFFICIENCY",
      content: `A continuation of the earlier case will make it clear what this means and why it matters. Why doesn't the outcome change under the given conditions? Because, says the standard account, the key factor remained in place. But, the skeptic will counter, perhaps we can discard that account; perhaps there's an alternative that fits the observations equally well. But, I would respond, even granting for argument's sake that such an alternative exists, it doesn't follow that it avoids more gaps than the one it replaces. It doesn't follow that it is comparable from a trade-off standpoint to the original—that it reduces as many issues as the old view while introducing no more new ones. In fact, the opposite often holds. Consider the alternative mentioned earlier. The cost of that account—meaning what new puzzles it creates—is vastly greater than its value—meaning what old puzzles it removes. It would be difficult to devise an account inconsistent with the conventional one that, while still matching the relevant evidence, is equally efficient in explanatory terms.`
    }
  ],
  "EPISTEMOLOGY": [
    {
      title: "RATIONAL BELIEF AND UNDERLYING STRUCTURE",
      content: `When would it become rational to believe that, next time, you're more likely than not to roll this as opposed to that number—that, for example, you're especially likely to roll a 27? This belief becomes rational when, and only when, you have reason to believe that a 27-roll is favored by the structures involved in the game. And that belief, in its turn, is rational if you know that circumstances at all like the following obtain: *The dice are magnetically attracted to the 27-slot. *On any given occasion, you have an unconscious intention to roll a 27 (even though you have no conscious intention of doing this), and you're such a talented dice-thrower that, if you can roll a 27 if it is your (subconscious) intention to do so. *The 27-slot is much bigger than any of the other slots.`
    },
    {
      title: "HUME, INDUCTION, AND THE LOGIC OF EXPLANATION",
      content: `We haven't yet refuted Hume's argument—we've only taken the first step towards doing so. Hume could defend his view against what we've said thus by far by saying the following: Suppose that, to explain why all phi's thus far known are psi's, you posit some underlying structure or law that disposes phi's to be psi's. Unless you think that nature is uniform, you have no right to expect that connection to continue to hold. But if, in order to deal with this, you suppose that nature is uniform, then you're caught in the vicious circle that I described.`
    },
    {
      title: "EXPLANATORY GOODNESS VS. CORRECTNESS",
      content: `For an explanation to be good isn't for it to be correct. Sometimes the right explanations are bad ones. A story will make this clear. I'm on a bus. The bus driver is smiling. A mystery! 'What on Earth does he have to smile about?' I ask myself. His job is so boring, and his life must therefore be such a horror.' But then I remember that, just a minute ago, a disembarking passenger gave him fifty $100 bills as a tip. So I have my explanation: 'he just came into a lot of money.'`
    },
    {
      title: "KNOWLEDGE VS. AWARENESS",
      content: `Knowledge is conceptually articulated awareness. In order for me to know that my shoes are uncomfortably tight, I need to have the concepts shoe, tight, discomfort, etc. I do not need to have these concepts—or, arguably, any concepts—to be aware of the uncomfortable tightness in my shoes. My knowledge of that truth is a conceptualization of my awareness of that state of affairs. Equivalently, there are two kinds of awareness: propositional and objectual.`
    }
  ],
  "PARADOXES": [
    {
      title: "The Loser Paradox",
      content: `People who are the bottom of a hierarchy are far less likely to spurn that hierarchy than they are to use it against people who are trying to climb the ranks of that hierarchy. The person who never graduates from college may in some contexts claim that a college degree is worthless, but he is unlikely to act accordingly. When he comes across someone without a college degree who is trying to make something of himself, he is likely to pounce on that person, claiming he is an uncredentialed fraud. Explanation: Losers want others to share their coffin, and if that involves hyper-valuing the very people or institutions that put them in that coffin, then so be it.`
    },
    {
      title: "The Sour Secretary Paradox",
      content: `The more useless a given employee is to the organization that employs her, the more unstintingly she will toe that organization's line. This is a corollary of the loser paradox.`
    },
    {
      title: "The Indie Writer's Paradox",
      content: `People don't give good reviews to writers who do not already have positive reviews. Analysis: This is a veridical paradox, in the sense that it describes an actual vicious circle and does not represent a logical blunder. An independent writer is by definition one who does not have a marketing apparatus behind him, and such a writer depends on uncoerced positive reviews. But people are extremely reluctant to give good reviews to writers who are not popular already or who do not have the weight of some institution behind them.`
    },
    {
      title: "Paradox of Connectedness",
      content: `Communications technology is supposed to connect us but separates us into self-contained, non-interacting units. Solution: Communications technology is not supposed to connect us emotionally. On the contrary, it is supposed to connect us in such a way that we can transact without having to bond emotionally. And that is what it does. It connects us logically while disconnecting us emotionally.`
    },
    {
      title: "Arrow's Information Paradox",
      content: `If you don't know what it is, you don't buy it. Therefore, you don't buy information unless you know what it is. But if you know what it is, you don't need to buy it. But information is bought. Solution: The obvious solution is that information can be described without being disclosed. I can tell you that I have the so and so's phone number without giving you that number, and the circumstances may give you reason to believe me.`
    },
    {
      title: "Buridan's Ass",
      content: `An ass that has to choose between food and water and is exactly as hungry as it is thirsty cannot make a choice and will therefore be paralyzed by indecision. But such an ass would in fact be able to make a decision. Explanation: This isn't exactly a paradox. There is nothing absurd in the supposition that a creature in such a situation might simply 'halt', and we don't know that actual biological creatures would not in fact halt in such a situation, since it seldom if ever happens that a creature is confronted with options that are exactly equally appealing.`
    },
    {
      title: "Obsessive-compulsive's Paradox",
      content: `If the obsessive-compulsive doesn't give in to his compulsions, he suffers. If he does give into them, they get worse. Solution: If the obsessive-compulsive fights his compulsions, they wither and go away.`
    },
    {
      title: "Analysis Paralysis Paradox",
      content: `Given that there is almost always a more rational course of action, the ability to identify rational courses of action may lead to a failure to act. Solution: There is a difference between intelligence and rationality. Intelligence answers the question: What is it objectively possible to do? Rationality answers the question: What do my limited resources of time, energy and intelligence make it incumbent on me to do? And the second answer breaks any deadlocks created by the first.`
    },
    {
      title: "The Primerica Paradox",
      content: `In order to work for Primerica, you need to have money, since you don't make any money working there. But if you have money you won't work for Primerica, because there is no reason to do so. And yet people work for Primerica. Explanation: Primerica is a multi-level insurance company. Its representatives have to pay to work there. They do not make a salary and only make money off of commissions. But they don't make money off of commissions since they almost never make sales, and they don't make sales because nobody wants Primerica insurance since it's bad and definitely don't want to buy it from some sleazy Primerica sales representative.`
    },
    {
      title: "The Leno Paradox",
      content: `The people who should commit suicide don't.`
    },
    {
      title: "Skeptical Bureaucrat Paradox",
      content: `When bureaucrats say they 'need more information', it's because they don't need it. They are determined not to help you and they're sending you on a fool's errand.`
    },
    {
      title: "The Forest Paradox",
      content: `Knowing involves not knowing too much. If you know too much about Smith, you are likely to make excuses for him. If you know just enough, you can't make excuses for him and you'll see him for what he is.`
    },
    {
      title: "The Larry David Paradox",
      content: `It is only when somebody has no merit that it becomes politically obligatory to say that they have merit.`
    },
    {
      title: "The Gratitude Paradox",
      content: `The people who should be the most grateful are the least grateful. Explanation: The people who should be the most grateful are losers who were bailed out, and they needed to bailed out because they don't have enough integrity to give credit where it is due.`
    },
    {
      title: "The Seinfeld Paradox",
      content: `You are far more likely to succeed as a comedian if you are medium funny than if you are actually funny.`
    },
    {
      title: "The Gas-guzzling Hippie Paradox",
      content: `Self-identified liberals claim to be pro-environment but on average have a dramatically higher environmental footprint than self-identified conservatives. Explanation: The self-identified conservative tends to be a do-it-yourselfer who takes a certain pride fixing his own machinery and in general taking the path of most resistance, whereas the self-identified liberal tends to be group-people and thus lack the loner's streak of eco-friendly do-it-your-selfism.`
    },
    {
      title: "The Progress Paradox",
      content: `Progress for man is often regress for a specific man. What is good for humanity as a whole often involves a given person being rendered unnecessary. For example, nothing could do more good for humanity than the digital optimization of education, but once education is duly digitized, an entire class of educational bureaucrats will be obsolete.`
    },
    {
      title: "The Conformist/Non-conformist Paradox",
      content: `When people become goths or hippies, they do so to be different but are in fact conforming to the norm.`
    },
    {
      title: "The Fake Rebel Paradox",
      content: `The fewer legitimate reasons there are to rebel in a given a society, the more self-identified rebels there are. Explanation: where there are legitimate reasons to rebel, it is dangerous to rebel.`
    },
    {
      title: "The Old Guard Hippie Paradox",
      content: `The hippies who self-identify as rebels are the establishment and the non-hippies on whom they trample are the actual rebels.`
    },
    {
      title: "The Good Lawyer Bad Lawyer Paradox",
      content: `In most cases, the reason you need a lawyer is to defend yourself against other lawyers, either because of direct affronts on their part or, more likely, because of gratuitous laws put in place by lawyers, along with a general air of litigiousness for which they are responsible.`
    },
    {
      title: "Suicide Paradox",
      content: `When people kill themselves, the only people they hurt are the ones who care about them.`
    },
    {
      title: "Churchill's Paradox",
      content: `In a non-democratic society, the government oppresses the people. In a democratic society, the people oppress themselves.`
    },
    {
      title: "Orlov's Paradox",
      content: `The more computers eliminate the need to do work, the more work we end up doing.`
    },
    {
      title: "Unemployment as Consequence of Macroeconomic Efficient Paradox",
      content: `An economy is efficient if few man-hours of work lead to high output and inefficient if many manhours of work lead to low output. This means that the more efficient an economy is, the higher the rate of employment, setting aside government-created, economically unnecessary employment.`
    },
    {
      title: "Hilbert-Bernays Paradox",
      content: `If there is a name of a natural number that is identical with the name of the successor that number, then some natural number is its own successor. The argument: Let h be a term referring to a such a natural number such that h is synonymous with 'the reference of h+1', and let n be the referent of h. Since h is synonymous with, and therefore has the same referent as 'the referent of h+1', it follows that the referent of h is n+1. And since n is by hypothesis the referent of h, it follows that n+n+1.`
    },
    {
      title: "Kuczynski's Recursion Paradox",
      content: `There is no recursive definition of the class of recursive definitions. Corollary: There is no formal characterization of formal truth.`
    },
    {
      title: "The Automation Paradox",
      content: `Everything can be automated except for automation itself.`
    },
    {
      title: "Heterological Paradox",
      content: `A word is 'heterological' if it is false of itself. Thus 'monosyllabic' is heterological, whereas 'polysyllabic' is not heterological. Question: Is 'heterological' heterological? It is if it isn't and if isn't if it is. Solution: To say that 'polysyllabic' is true of itself is to say that 'polysyllabic' is polysyllabic. 'True of itself,' when meaningful, simply abbreviates some non-reflexive construction; and when it doesn't do so, the term 'self' an undefined pronoun—a free variable, in other words.`
    },
    {
      title: "The Liar Paradox",
      content: `Suppose Smith says "I am lying." He is lying if he's telling the truth and he's telling the truth if he's lying. Analysis: It is not words per se but the underlying meanings, or propositions, that are true or false. So when Smith says "I am lying", what he is saying, if stated perspicuously, is to the effect that: There exists a proposition P such that P is false if affirmed and true if denied and such that, moreover, I am not affirming P.`
    },
    {
      title: "Berry's Paradox",
      content: `The expression "the first number not nameable in under ten words" names that number in nine words. Solution: There are different ways of picking out a number. The canonical way of doing so is by using the usual numerical notation. Thus, the expression "117,334" is the canonical way of picking out the corresponding number, but "the exact number of dollars in Jim's saving's account" is not.`
    },
    {
      title: "Wittgenstein's Rule-following Paradox",
      content: `Any given course of conduct complies with many different rules, and there is therefore no good reason to say of a given act that it is an act of following this as opposed to that rule. So any putative case of following a given rule might equally reasonably be seen as a case of following some other, incompatible rule, and there is therefore no good reason to regard any act as a case of following any given rule.`
    },
    {
      title: "The Sorites Paradox",
      content: `A single grain of sand is not a heap. If n grains of sand, then neither are n+1 grains. Therefore, a billion grains of sands are not a heap. Analysis: Three grains of sand is more of a heap than two; four are more of a heap than three. n+1 grains of sand are more 'heapy' than n grains. If, for arbitrary n, n grains of sand qualify as a heap, they do so because they are heapy enough relative to some benchmark.`
    }
  ]
};

// Style presets with 1-8 being most important for humanization
const STYLE_PRESETS = [
  // Most important for humanization (1-8)
  { id: "mixed-cadence", label: "1. Mixed cadence + clause sprawl", important: true, description: "Alternate short and long sentences; allow some long sentences to wander with extra clauses." },
  { id: "asymmetric-emphasis", label: "2. Asymmetric emphasis", important: true, description: "Over-elaborate one point; compress or skate past another." },
  { id: "one-aside", label: "3. One aside", important: true, description: "Add a quick parenthetical or em-dash remark — factual, not jokey." },
  { id: "hedge-twice", label: "4. Hedge twice", important: true, description: "Use two mild uncertainty markers (\"probably,\" \"seems,\" \"roughly,\" \"I think\")." },
  { id: "local-disfluency", label: "5. Local disfluency", important: true, description: "Keep one redundant or slightly awkward phrase that still makes sense." },
  { id: "analogy-injection", label: "6. Analogy injection", important: true, description: "Insert a short, concrete comparison to something unrelated but illustrative." },
  { id: "topic-snap", label: "7. Topic snap", important: true, description: "Abruptly shift focus once, then return." },
  { id: "friction-detail", label: "8. Friction detail", important: true, description: "Drop in a small, seemingly unnecessary but real-world-plausible detail." },
  
  // Structure & Cadence
  { id: "compression-light", label: "Compression — light (−15%)", important: false, description: "Cut filler; merge short clauses; keep meaning." },
  { id: "compression-medium", label: "Compression — medium (−30%)", important: false, description: "Trim hard; delete throat-clearing; tighten syntax." },
  { id: "compression-heavy", label: "Compression — heavy (−45%)", important: false, description: "Sever redundancies; collapse repeats; keep core claims." },
  { id: "decrease-50", label: "DECREASE BY 50%", important: false, description: "REDUCE THE LENGTH BY HALF WHILE PRESERVING MEANING" },
  { id: "increase-150", label: "INCREASE BY 150%", important: false, description: "EXPAND THE TEXT TO 150% LONGER WITH ADDITIONAL DETAIL AND ELABORATION" },
  { id: "mixed-cadence-alt", label: "Mixed cadence", important: false, description: "Alternate 5–35-word sentences; no uniform rhythm." },
  { id: "clause-surgery", label: "Clause surgery", important: false, description: "Reorder main/subordinate clauses in 30% of sentences." },
  { id: "front-load-claim", label: "Front-load claim", important: false, description: "Put the main conclusion in sentence 1; support follows." },
  { id: "back-load-claim", label: "Back-load claim", important: false, description: "Delay the conclusion to the final 2–3 sentences." },
  { id: "seam-pivot", label: "Seam/pivot", important: false, description: "Drop smooth connectors once; abrupt turn is fine." },
  
  // Framing & Inference
  { id: "imply-one-step", label: "Imply one step", important: false, description: "Omit an obvious inferential step; leave it implicit." },
  { id: "conditional-framing", label: "Conditional framing", important: false, description: "Recast one key sentence as \"If/Unless …, then …\"." },
  { id: "local-contrast", label: "Local contrast", important: false, description: "Use \"but/except/aside\" once to mark a boundary—no new facts." },
  { id: "scope-check", label: "Scope check", important: false, description: "Replace one absolute with a bounded form (\"in cases like these\")." },
  
  // Diction & Tone
  { id: "deflate-jargon", label: "Deflate jargon", important: false, description: "Swap nominalizations for verbs where safe (e.g., \"utilization\" → \"use\")." },
  { id: "kill-stock-transitions", label: "Kill stock transitions", important: false, description: "Delete \"Moreover/Furthermore/In conclusion\" everywhere." },
  { id: "hedge-once", label: "Hedge once", important: false, description: "Use exactly one: \"probably/roughly/more or less.\"" },
  { id: "drop-intensifiers", label: "Drop intensifiers", important: false, description: "Remove \"very/clearly/obviously/significantly.\"" },
  { id: "low-heat-voice", label: "Low-heat voice", important: false, description: "Prefer plain verbs; avoid showy synonyms." },
  { id: "one-aside-alt", label: "One aside", important: false, description: "One short parenthetical or em-dash aside; keep it factual." },
  
  // Concreteness & Benchmarks
  { id: "concrete-benchmark", label: "Concrete benchmark", important: false, description: "Replace one vague scale with a testable one (e.g., \"enough to X\")." },
  { id: "swap-generic-example", label: "Swap generic example", important: false, description: "If the source has an example, make it slightly more specific; else skip." },
  { id: "metric-nudge", label: "Metric nudge", important: false, description: "Replace \"more/better\" with a minimal, source-safe comparator (\"more than last case\")." },
  
  // Asymmetry & Focus
  { id: "asymmetric-emphasis-alt", label: "Asymmetric emphasis", important: false, description: "Linger on the main claim; compress secondary points sharply." },
  { id: "cull-repeats", label: "Cull repeats", important: false, description: "Delete duplicated sentences/ideas; keep the strongest instance." },
  { id: "topic-snap-alt", label: "Topic snap", important: false, description: "Change focus abruptly once; no recap." },
  
  // Formatting & Output Hygiene
  { id: "no-lists", label: "No lists", important: false, description: "Force continuous prose; remove bullets/numbering." },
  { id: "no-meta", label: "No meta", important: false, description: "No prefaces, apologies, or \"as requested\" scaffolding." },
  { id: "exact-nouns", label: "Exact nouns", important: false, description: "Replace vague pronouns where antecedent is ambiguous." },
  { id: "quote-once", label: "Quote once", important: false, description: "If the source contains a strong phrase, quote it once; else skip." },
  
  // Safety / Guardrails
  { id: "claim-lock", label: "Claim lock", important: false, description: "Do not add examples, scenarios, or data not present in the source." },
  { id: "entity-lock", label: "Entity lock", important: false, description: "Keep names, counts, and attributions exactly as given." },
  
  // Combo presets
  { id: "lean-sharp", label: "Lean & Sharp", important: false, description: "Compression-medium + mixed cadence + imply one step + kill stock transitions." },
  { id: "analytic", label: "Analytic", important: false, description: "Clause surgery + front-load claim + scope check + exact nouns + no lists." },
];

interface ChunkData {
  id: string;
  content: string;
  startIndex: number;
  endIndex: number;
  aiScore?: number;
}

interface AITextRewriterProps {
  className?: string;
  onSendToStudentSubmission?: (text: string) => void;
  onSendToBoxA?: (text: string) => void;
}

export default function AITextRewriter({ className, onSendToStudentSubmission, onSendToBoxA }: AITextRewriterProps) {
  // Authentication state
  const { data: authData } = useQuery({
    queryKey: ["/api/auth/me"],
    retry: false,
  });
  const user = (authData as any)?.user;
  const isAuthenticated = !!user;
  
  const [inputText, setInputText] = useState("");
  const [styleSample, setStyleSample] = useState("");
  const [outputText, setOutputText] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [llmProvider, setLlmProvider] = useState("anthropic"); // Default to Anthropic
  const [temperature, setTemperature] = useState(0.7);
  
  const [selectedStyleSample, setSelectedStyleSample] = useState("FORMAL AND FUNCTIONAL RELATIONSHIPS");
  const [selectedStyleCategory, setSelectedStyleCategory] = useState("CONTENT-NEUTRAL");
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  
  const [isRewriting, setIsRewriting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [inputAiScore, setInputAiScore] = useState<number | null>(null);
  const [styleSampleAiScore, setStyleSampleAiScore] = useState<number | null>(null);
  const [outputAiScore, setOutputAiScore] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const [chunks, setChunks] = useState<ChunkData[]>([]);
  const [selectedChunks, setSelectedChunks] = useState<string[]>([]);
  const [showChunkDialog, setShowChunkDialog] = useState(false);
  
  const { toast } = useToast();

  // Set default style sample on component mount
  useEffect(() => {
    const defaultSample = STYLE_SAMPLES["CONTENT-NEUTRAL"].find(sample => 
      sample.title === "FORMAL AND FUNCTIONAL RELATIONSHIPS"
    );
    if (defaultSample && !styleSample) {
      setStyleSample(defaultSample.content);
    }
  }, []);

  // Automatically analyze input text when it changes
  useEffect(() => {
    const analyzeInputDebounced = setTimeout(() => {
      if (inputText.trim()) {
        handleAnalyzeText(inputText, 'input');
      } else {
        setInputAiScore(null);
      }
    }, 1000);

    return () => clearTimeout(analyzeInputDebounced);
  }, [inputText]);

  // Automatically analyze style sample when it changes
  useEffect(() => {
    const analyzeStyleSampleDebounced = setTimeout(() => {
      if (styleSample.trim()) {
        handleAnalyzeText(styleSample, 'styleSample');
      } else {
        setStyleSampleAiScore(null);
      }
    }, 1000);

    return () => clearTimeout(analyzeStyleSampleDebounced);
  }, [styleSample]);

  // Automatically analyze output text when it changes
  useEffect(() => {
    const analyzeOutputDebounced = setTimeout(() => {
      if (outputText.trim()) {
        handleAnalyzeText(outputText, 'output');
      } else {
        setOutputAiScore(null);
      }
    }, 1000);

    return () => clearTimeout(analyzeOutputDebounced);
  }, [outputText]);

  const handleAnalyzeText = async (text: string, type: 'input' | 'styleSample' | 'output') => {
    if (!text.trim()) return null;
    
    setIsAnalyzing(true);
    try {
      const response = await apiRequest("POST", "/api/ai-rewriter/analyze-text", { text });
      const data = await response.json();
      
      if (type === 'input') {
        setInputAiScore(data.aiScore);
      } else if (type === 'styleSample') {
        setStyleSampleAiScore(data.aiScore);
      } else {
        setOutputAiScore(data.aiScore);
      }
      
      return data.aiScore;
    } catch (error: any) {
      console.error("AI Analysis error:", error);
      
      // Don't show error toasts for AI detection - just return null for graceful degradation
      // Users can still use the rewriter without AI detection scores
      
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStyleSampleChange = (value: string) => {
    setSelectedStyleSample(value);
    
    // Find the sample in any category
    for (const [category, samples] of Object.entries(STYLE_SAMPLES)) {
      const sample = samples.find(s => s.title === value);
      if (sample) {
        setStyleSample(sample.content);
        setSelectedStyleCategory(category);
        break;
      }
    }
  };

  const handlePresetToggle = (presetId: string, checked: boolean) => {
    if (checked) {
      setSelectedPresets([...selectedPresets, presetId]);
    } else {
      setSelectedPresets(selectedPresets.filter(id => id !== presetId));
    }
  };

  const generateCustomInstructions = () => {
    const selectedPresetObjects = STYLE_PRESETS.filter(preset => selectedPresets.includes(preset.id));
    return selectedPresetObjects.map(preset => preset.description).join(' ');
  };

  const handleRewrite = async () => {
    if (!inputText.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter text to rewrite in Box A",
        variant: "destructive"
      });
      return;
    }

    setIsRewriting(true);
    try {
      const instructions = [
        customInstructions.trim(),
        generateCustomInstructions()
      ].filter(Boolean).join(' ');

      const response = await apiRequest("POST", "/api/ai-rewriter/rewrite", {
        inputText: inputText.trim(),
        styleSample: (styleSample ?? "").toString(),
        customInstructions: (instructions ?? "").toString(), // <-- force string, never null
        llmProvider,
        llmModel: "claude-3-7-sonnet", // Default model
        temperature,
      });

      const data = await response.json();
      setOutputText(data.rewrittenText);
      setSessionId(data.sessionId);
      
      toast({
        title: "Rewrite Complete",
        description: `Input: ${inputAiScore ?? data.inputAiScore ?? 0}% AI • Output: ${data.outputAiScore ?? outputAiScore ?? 0}% AI`,
      });

    } catch (error: any) {
      console.error("Error rewriting text:", error);
      
      // Simple error handling - let the backend determine what the user can access
      toast({
        title: "Rewrite Error",
        description: error.message || "Failed to rewrite text. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsRewriting(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/ai-rewriter/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();
      
      // If document needs chunking, show chunk selection dialog
      if (result.needsChunking && result.chunks && result.chunks.length > 0) {
        const chunksWithIds = result.chunks.map((chunk: any, index: number) => ({
          id: `chunk-${index}`,
          content: chunk.content,
          startIndex: chunk.startIndex || 0,
          endIndex: chunk.endIndex || chunk.content.length,
          aiScore: chunk.aiScore
        }));
        setChunks(chunksWithIds);
        setSelectedChunks(chunksWithIds.map((c: ChunkData) => c.id)); // Select all by default
        setShowChunkDialog(true);
      } else {
        // Small document, load directly
        setInputText(result.content);
        setInputAiScore(result.aiScore);
      }
      
      toast({
        title: "File Uploaded",
        description: `Loaded ${result.wordCount} words (${result.aiScore}% AI)`,
      });

    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast({
        title: "Upload Error",
        description: error.message || "Failed to upload file",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleChunkSelection = () => {
    const selectedChunkContents = chunks
      .filter(chunk => selectedChunks.includes(chunk.id))
      .map(chunk => chunk.content)
      .join('\n\n');
    
    setInputText(selectedChunkContents);
    setShowChunkDialog(false);
    
    // Calculate average AI score for selected chunks
    const selectedChunkData = chunks.filter(chunk => selectedChunks.includes(chunk.id));
    if (selectedChunkData.length > 0) {
      const avgAiScore = selectedChunkData.reduce((sum, chunk) => sum + (chunk.aiScore || 0), 0) / selectedChunkData.length;
      setInputAiScore(Math.round(avgAiScore));
    }
  };

  const handleDownload = async (format: 'pdf' | 'docx' | 'txt') => {
    if (!outputText.trim()) {
      toast({
        title: "No Content",
        description: "No rewritten text to download",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch(`/api/ai-rewriter/download/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: outputText,
          filename: "rewritten-text",
        }),
      });

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rewritten-text.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Complete",
        description: `Downloaded rewritten text as ${format.toUpperCase()}`,
      });

    } catch (error: any) {
      console.error("Error downloading file:", error);
      toast({
        title: "Download Error",
        description: error.message || `Failed to download ${format.toUpperCase()}`,
        variant: "destructive"
      });
    }
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            AI Text Rewriter
            {!isAuthenticated && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                (Preview Mode)
              </span>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Rewrite content to exactly match the style of your reference text at the most granular level possible.
          </p>
          {!isAuthenticated && (
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
              <div className="flex items-center gap-3">
                <LogIn className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Login for Full Access
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Currently in preview mode. Login to access AI analysis, full text rewriting, and download features.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href="/login">
                    <Button size="sm" variant="outline" data-testid="button-login">
                      Login
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button size="sm" data-testid="button-register">
                      Register
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Sidebar - Style Samples and Presets */}
            <div className="lg:col-span-1 space-y-6">
              {/* LLM Provider Selection */}
              <div className="space-y-2">
                <Label htmlFor="llm-provider">LLM Provider</Label>
                <Select value={llmProvider} onValueChange={setLlmProvider}>
                  <SelectTrigger data-testid="select-llm-provider">
                    <SelectValue placeholder="Select LLM Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {LLM_PROVIDERS.map((provider) => (
                      <SelectItem key={provider.value} value={provider.value}>
                        {provider.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Style Samples Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="style-samples">Writing Samples</Label>
                <Select value={selectedStyleSample} onValueChange={handleStyleSampleChange}>
                  <SelectTrigger data-testid="select-style-sample">
                    <SelectValue placeholder="Select a writing sample" />
                  </SelectTrigger>
                  <SelectContent className="max-h-96">
                    {Object.entries(STYLE_SAMPLES).map(([category, samples]) => (
                      <div key={category}>
                        <div className="px-2 py-1 text-sm font-semibold text-muted-foreground border-b">
                          {category}
                        </div>
                        {samples.map((sample) => (
                          <SelectItem key={sample.title} value={sample.title}>
                            {sample.title}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Style Presets */}
              <div className="space-y-2">
                <Label>Style Presets</Label>
                <div className="text-xs text-muted-foreground mb-2">
                  Items 1-8 are most important for humanization
                </div>
                <div className="max-h-96 overflow-y-auto space-y-2 border rounded-md p-3">
                  {STYLE_PRESETS.map((preset) => (
                    <div key={preset.id} className="flex items-start space-x-2">
                      <Checkbox
                        id={preset.id}
                        checked={selectedPresets.includes(preset.id)}
                        onCheckedChange={(checked) => handlePresetToggle(preset.id, checked as boolean)}
                        data-testid={`checkbox-preset-${preset.id}`}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label
                          htmlFor={preset.id}
                          className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer ${
                            preset.important ? 'text-primary font-semibold' : ''
                          }`}
                        >
                          {preset.label}
                          {preset.important && <span className="text-xs ml-1">(IMPORTANT)</span>}
                        </label>
                        <p className="text-xs text-muted-foreground">
                          {preset.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Main Content - Three Boxes */}
            <div className="lg:col-span-3 space-y-6">
              {/* Three Main Boxes Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Box A - Input Text */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="input-text">Box A - Input Text</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="file-upload"
                        data-testid="input-file-upload"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById("file-upload")?.click()}
                        disabled={isUploading}
                        data-testid="button-upload-file"
                      >
                        {isUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setInputText("")}
                        disabled={!inputText}
                        title="Clear Box A"
                        data-testid="button-clear-box-a"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                      {inputAiScore !== null && (
                        <span className="text-xs text-muted-foreground">
                          {inputAiScore}% AI
                        </span>
                      )}
                    </div>
                  </div>
                  <Textarea
                    id="input-text"
                    placeholder="Enter or upload text to be rewritten..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                    data-testid="textarea-input-text"
                  />
                </div>

                {/* Box B - Style Sample */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="style-sample">Box B - Style Sample</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStyleSample("")}
                        disabled={!styleSample}
                        title="Clear Box B"
                        data-testid="button-clear-box-b"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                      {styleSampleAiScore !== null && (
                        <span className="text-xs text-muted-foreground">
                          {styleSampleAiScore}% AI
                        </span>
                      )}
                    </div>
                  </div>
                  <Textarea
                    id="style-sample"
                    placeholder="Enter text whose writing style you want to mimic..."
                    value={styleSample}
                    onChange={(e) => setStyleSample(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                    data-testid="textarea-style-sample"
                  />
                </div>

                {/* Box C - Output Text */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="output-text">Box C - Rewritten Output</Label>
                    <div className="flex items-center gap-2">
                      {outputAiScore !== null && (
                        <span className="text-xs text-muted-foreground">
                          {outputAiScore}% AI
                        </span>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(outputText)}
                        disabled={!outputText}
                        title="Copy to Clipboard"
                        data-testid="button-copy-output"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </Button>
                      {onSendToStudentSubmission && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onSendToStudentSubmission(outputText)}
                          disabled={!outputText}
                          title="Send to Student Submission"
                          data-testid="button-send-to-student"
                          className="text-green-600 hover:text-green-700"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOutputText("")}
                        disabled={!outputText}
                        title="Clear Box C"
                        data-testid="button-clear-box-c"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload('txt')}
                        disabled={!outputText}
                        data-testid="button-download-txt"
                      >
                        <Download className="h-4 w-4" />
                        TXT
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload('docx')}
                        disabled={!outputText}
                        data-testid="button-download-docx"
                      >
                        <Download className="h-4 w-4" />
                        DOCX
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload('pdf')}
                        disabled={!outputText}
                        data-testid="button-download-pdf"
                      >
                        <Download className="h-4 w-4" />
                        PDF
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    id="output-text"
                    placeholder="Rewritten text will appear here..."
                    value={outputText}
                    readOnly
                    className="min-h-[300px] font-mono text-sm bg-muted"
                    data-testid="textarea-output-text"
                  />
                </div>
              </div>

              {/* Custom Instructions */}
              <div className="space-y-2">
                <Label htmlFor="custom-instructions">Custom Instructions (Optional)</Label>
                <Textarea
                  id="custom-instructions"
                  placeholder="Add any specific instructions for the rewriting process..."
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  className="min-h-[80px]"
                  data-testid="textarea-custom-instructions"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center gap-4">
                <Button
                  onClick={handleRewrite}
                  disabled={isRewriting || !inputText.trim()}
                  className="px-8"
                  data-testid="button-rewrite"
                >
                  {isRewriting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Rewriting...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Rewrite Text
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chunk Selection Dialog */}
      <Dialog open={showChunkDialog} onOpenChange={setShowChunkDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Text Chunks to Rewrite</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your document has been divided into chunks. Select which chunks you want to rewrite:
            </p>
            {chunks.map((chunk) => (
              <div key={chunk.id} className="flex items-start space-x-3 p-3 border rounded">
                <Checkbox
                  checked={selectedChunks.includes(chunk.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedChunks([...selectedChunks, chunk.id]);
                    } else {
                      setSelectedChunks(selectedChunks.filter(id => id !== chunk.id));
                    }
                  }}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm font-medium">Chunk {chunk.id.split('-')[1]}</span>
                    {chunk.aiScore !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {chunk.aiScore}% AI
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {chunk.content.substring(0, 200)}...
                  </p>
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowChunkDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleChunkSelection} disabled={selectedChunks.length === 0}>
                Use Selected Chunks ({selectedChunks.length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}