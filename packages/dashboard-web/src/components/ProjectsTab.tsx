import { useQuery } from "@tanstack/react-query";
import {
	Activity,
	Calendar,
	Clock,
	Folder,
	FolderOpen,
	Star,
	Users,
} from "lucide-react";
import { api, type Project } from "../api";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Separator } from "./ui/separator";
import { Skeleton } from "./ui/skeleton";

export function ProjectsTab() {
	const {
		data: projects,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["projects"],
		queryFn: () => api.getProjects(),
		refetchInterval: 30000,
	});

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{[...Array(6)].map((_, i) => (
						<Card key={i}>
							<CardHeader>
								<Skeleton className="h-4 w-[200px]" />
								<Skeleton className="h-3 w-[100px]" />
							</CardHeader>
							<CardContent>
								<Skeleton className="h-20 w-full" />
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<Card>
				<CardContent className="pt-6">
					<div className="text-center">
						<div className="text-muted-foreground">
							Failed to load projects. Please try again.
						</div>
						<Button
							variant="outline"
							className="mt-4"
							onClick={() => window.location.reload()}
						>
							Retry
						</Button>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!projects || projects.length === 0) {
		return (
			<Card>
				<CardContent className="pt-6">
					<div className="text-center space-y-4">
						<FolderOpen className="h-12 w-12 text-muted-foreground mx-auto" />
						<div>
							<h3 className="text-lg font-semibold">No Projects Found</h3>
							<p className="text-muted-foreground">
								Create a .claude file in your project directory to get started
								with project tracking.
							</p>
						</div>
						<div className="text-sm text-muted-foreground space-y-2">
							<p>Projects are automatically discovered when:</p>
							<ul className="list-disc list-inside text-left max-w-md mx-auto">
								<li>Claude Code agents work on projects with .claude files</li>
								<li>The Project Discovery Agent scans for new projects</li>
								<li>Sessions are tracked through the feedback system</li>
							</ul>
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-6">
			{/* Summary Stats */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Total Projects
						</CardTitle>
						<Folder className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{projects.length}</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Total Sessions
						</CardTitle>
						<Activity className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{projects.reduce((sum, p) => sum + p.total_sessions, 0)}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Avg Satisfaction
						</CardTitle>
						<Star className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{(
								projects.reduce((sum, p) => sum + p.avg_satisfaction, 0) /
								projects.length
							).toFixed(1)}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Active Projects
						</CardTitle>
						<Users className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{
								projects.filter(
									(p) =>
										new Date(p.last_activity) >
										new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
								).length
							}
						</div>
						<p className="text-xs text-muted-foreground">Last 7 days</p>
					</CardContent>
				</Card>
			</div>

			{/* Projects Grid */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{projects.map((project) => (
					<ProjectCard key={project.id} project={project} />
				))}
			</div>
		</div>
	);
}

function ProjectCard({ project }: { project: Project }) {
	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	const formatPath = (path: string) => {
		const parts = path.split(/[/\\]/);
		return parts.slice(-2).join("/");
	};

	const _getSatisfactionColor = (rating: number) => {
		if (rating >= 4.5) return "text-green-600";
		if (rating >= 3.5) return "text-yellow-600";
		return "text-red-600";
	};

	const getSatisfactionBadge = (rating: number) => {
		if (rating >= 4.5) return "bg-green-100 text-green-800";
		if (rating >= 3.5) return "bg-yellow-100 text-yellow-800";
		return "bg-red-100 text-red-800";
	};

	return (
		<Card className="hover:shadow-md transition-shadow">
			<CardHeader>
				<div className="flex items-start justify-between">
					<div className="space-y-1">
						<CardTitle className="text-lg leading-6">{project.name}</CardTitle>
						<p className="text-sm text-muted-foreground">
							{formatPath(project.path)}
						</p>
					</div>
					<Badge
						className={getSatisfactionBadge(project.avg_satisfaction)}
						variant="secondary"
					>
						★ {project.avg_satisfaction.toFixed(1)}
					</Badge>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{/* Stats */}
					<div className="flex items-center justify-between text-sm">
						<div className="flex items-center gap-1">
							<Activity className="h-3 w-3 text-muted-foreground" />
							<span className="text-muted-foreground">Sessions:</span>
							<span className="font-medium">{project.total_sessions}</span>
						</div>
						<div className="flex items-center gap-1">
							<Clock className="h-3 w-3 text-muted-foreground" />
							<span className="text-muted-foreground">
								{formatDate(project.last_activity)}
							</span>
						</div>
					</div>

					<Separator />

					{/* Dates */}
					<div className="space-y-2 text-sm">
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground">Created:</span>
							<span>{formatDate(project.created_at)}</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground">Last Active:</span>
							<span>{formatDate(project.last_activity)}</span>
						</div>
					</div>

					{/* Actions */}
					<div className="flex gap-2">
						<Button variant="outline" size="sm" className="flex-1">
							<Calendar className="h-3 w-3 mr-1" />
							View Sessions
						</Button>
						<Button variant="outline" size="sm" className="flex-1">
							<Folder className="h-3 w-3 mr-1" />
							Open Path
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
