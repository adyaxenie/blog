export type ProjectStatus = "Live" | "Building" | "Paused" | "Failed";

export interface HomepageProject {
  name: string;
  status: ProjectStatus;
}

export const homepageProjects: HomepageProject[] = [
  { name: "dailyglowup app", status: "Live" },
  { name: "RL.TCG", status: "Failed" },
  { name: "PDF Dino", status: "Live" },
  { name: "SupBot AI", status: "Failed" },
];
