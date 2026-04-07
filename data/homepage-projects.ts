export type ProjectStatus = "Live" | "Building" | "Paused" | "Failed";

export interface HomepageProject {
  name: string;
  status: ProjectStatus;
}

export const homepageProjects: HomepageProject[] = [
  { name: "dailyglowup.app", status: "Live" },
  { name: "rltcg.com", status: "Failed" },
  { name: "pdfdino.com", status: "Live" },
  { name: "supbot.io", status: "Failed" },
];
