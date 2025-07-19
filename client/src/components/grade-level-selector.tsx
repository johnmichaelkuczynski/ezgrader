import { useState } from "react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoIcon } from "lucide-react";

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

export const gradeLevelOptions = [
  { value: "elementary_early", label: "Elementary School (K-2)" },
  { value: "elementary_mid", label: "Elementary School (3-5)" },
  { value: "middle_school", label: "Middle School (6-8)" },
  { value: "high_school_remedial", label: "High School - Remedial" },
  { value: "high_school_regular", label: "High School - Standard" },
  { value: "high_school_honors", label: "High School - Honors/AP" },
  { value: "high_school_gifted", label: "High School - Gifted" },
  { value: "community_college", label: "Community College" },
  { value: "undergraduate_remedial", label: "Undergraduate - Remedial" },
  { value: "undergraduate_regular", label: "Undergraduate - Standard" },
  { value: "undergraduate_honors", label: "Undergraduate - Honors" },
  { value: "masters", label: "Graduate - Masters" },
  { value: "doctoral", label: "Graduate - PhD/Doctoral" },
  { value: "professional", label: "Professional School (Law, Med, etc.)" },
  { value: "custom", label: "Custom Level" },
];

// Grade level descriptions for tooltips to help teachers understand the selection
const gradeLevelDescriptions: Record<GradeLevel, string> = {
  elementary_early: "For young learners in grades K-2, focusing on fundamental knowledge and skills with very simple language.",
  elementary_mid: "For students in grades 3-5, with developing academic abilities and slightly more complex expectations.",
  middle_school: "For students in grades 6-8, with emerging critical thinking and more sophisticated academic expectations.",
  high_school_regular: "For typical high school students with standard academic capabilities.",
  high_school_remedial: "For high school students who need additional support or simplified concepts.",
  high_school_honors: "For advanced high school students in honors or AP courses with higher expectations.",
  high_school_gifted: "For exceptionally talented high school students who can handle college-level work.",
  community_college: "For community college students with variable academic backgrounds.",
  undergraduate_remedial: "For college students needing foundational support in specific subjects.",
  undergraduate_regular: "For typical undergraduate students at 4-year institutions.",
  undergraduate_honors: "For high-achieving undergraduate students in specialized programs.",
  masters: "For graduate students pursuing masters-level coursework with advanced expectations.",
  doctoral: "For PhD candidates and doctoral students with expert-level expectations.",
  professional: "For students in professional schools like law, medicine, or business.",
  custom: "Define your own custom academic level with specific expectations."
};

interface GradeLevelSelectorProps {
  value: GradeLevel;
  onChange: (value: GradeLevel) => void;
}

export default function GradeLevelSelector({ value, onChange }: GradeLevelSelectorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center">
        <Label htmlFor="grade-level" className="mr-2">Academic Level</Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <InfoIcon className="h-4 w-4 text-gray-500" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Select the academic level of your students. This helps calibrate feedback appropriately for their developmental stage.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <Select 
        value={value} 
        onValueChange={(val) => onChange(val as GradeLevel)}
      >
        <SelectTrigger className="w-[280px]" id="grade-level">
          <SelectValue placeholder="Select academic level" />
        </SelectTrigger>
        <SelectContent>
          {gradeLevelOptions.map((option) => (
            <TooltipProvider key={option.value}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SelectItem value={option.value}>
                    {option.label}
                  </SelectItem>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p>{gradeLevelDescriptions[option.value as GradeLevel]}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}