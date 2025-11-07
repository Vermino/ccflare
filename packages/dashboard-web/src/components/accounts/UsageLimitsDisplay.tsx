import { AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import type { Account } from "../../api";
import { cn } from "../../lib/utils";
import { Progress } from "../ui/progress";

interface UsageLimitsDisplayProps {
	account: Account;
	className?: string;
}

export function UsageLimitsDisplay({
	account,
	className,
}: UsageLimitsDisplayProps) {
	const [now, setNow] = useState(Date.now());

	useEffect(() => {
		const interval = setInterval(() => setNow(Date.now()), 10000); // Update every 10 seconds
		return () => clearInterval(interval);
	}, []);

	const has5hData = account.unified_5h_status && account.unified_5h_reset;
	const has7dData = account.unified_7d_status && account.unified_7d_reset;

	if (!has5hData && !has7dData) {
		return (
			<div className={cn("text-xs text-muted-foreground", className)}>
				No usage data available
			</div>
		);
	}

	// Parse 5-hour limit
	let fiveHourPercentage = 0;
	let fiveHourRemaining = "";
	let fiveHourStatus: "ok" | "warning" | "limited" = "ok";

	if (has5hData) {
		const resetTime = account.unified_5h_reset!;
		const remainingMs = Math.max(0, resetTime - now);
		const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
		const remainingMins = Math.floor(
			(remainingMs % (60 * 60 * 1000)) / (60 * 1000),
		);

		if (remainingMs > 0) {
			if (remainingHours > 0) {
				fiveHourRemaining = `${remainingHours}h ${remainingMins}m`;
			} else {
				fiveHourRemaining = `${remainingMins}m`;
			}
		} else {
			fiveHourRemaining = "Ready";
		}

		// Determine percentage from status string
		if (account.unified_5h_status === "available") {
			fiveHourPercentage = 0;
			fiveHourStatus = "ok";
		} else if (account.unified_5h_status?.includes("rate_limited")) {
			fiveHourPercentage = 100;
			fiveHourStatus = "limited";
		} else {
			// Try to parse fallback percentage
			const fallback = account.unified_fallback_percentage;
			if (fallback !== null && fallback !== undefined) {
				fiveHourPercentage = fallback;
				fiveHourStatus = fallback > 80 ? "warning" : "ok";
			}
		}
	}

	// Parse 7-day limit
	let sevenDayPercentage = 0;
	let sevenDayRemaining = "";
	let sevenDayStatus: "ok" | "warning" | "limited" = "ok";

	if (has7dData) {
		const resetTime = account.unified_7d_reset!;
		const remainingMs = Math.max(0, resetTime - now);
		const remainingDays = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
		const remainingHours = Math.floor(
			(remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000),
		);

		if (remainingMs > 0) {
			if (remainingDays > 0) {
				sevenDayRemaining = `${remainingDays}d ${remainingHours}h`;
			} else if (remainingHours > 0) {
				sevenDayRemaining = `${remainingHours}h`;
			} else {
				sevenDayRemaining = "< 1h";
			}
		} else {
			sevenDayRemaining = "Ready";
		}

		// Determine percentage from status string
		if (account.unified_7d_status === "available") {
			sevenDayPercentage = 0;
			sevenDayStatus = "ok";
		} else if (account.unified_7d_status?.includes("rate_limited")) {
			sevenDayPercentage = 100;
			sevenDayStatus = "limited";
		} else {
			// Estimate based on time remaining (7 days = 168 hours)
			const totalMs = 7 * 24 * 60 * 60 * 1000;
			const resetTime = account.unified_7d_reset!;
			const remainingMs = Math.max(0, resetTime - now);
			const elapsed = totalMs - remainingMs;
			sevenDayPercentage = Math.min(100, (elapsed / totalMs) * 100);
			sevenDayStatus = sevenDayPercentage > 80 ? "warning" : "ok";
		}
	}

	const getStatusIcon = (status: "ok" | "warning" | "limited") => {
		switch (status) {
			case "ok":
				return <CheckCircle className="h-4 w-4 text-green-500" />;
			case "warning":
				return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
			case "limited":
				return <Clock className="h-4 w-4 text-red-500" />;
		}
	};

	const getProgressColor = (status: "ok" | "warning" | "limited") => {
		switch (status) {
			case "ok":
				return "bg-green-500";
			case "warning":
				return "bg-yellow-500";
			case "limited":
				return "bg-red-500";
		}
	};

	return (
		<div className={cn("space-y-4", className)}>
			{/* 5-Hour Session Limit */}
			{has5hData && (
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							{getStatusIcon(fiveHourStatus)}
							<span className="text-sm font-medium">5-Hour Session</span>
						</div>
						<span className="text-xs text-muted-foreground">
							{fiveHourPercentage.toFixed(0)}%
						</span>
					</div>
					<Progress
						value={fiveHourPercentage}
						className="h-2"
						indicatorClassName={getProgressColor(fiveHourStatus)}
					/>
					<div className="flex items-center justify-between text-xs text-muted-foreground">
						<span>{account.unified_5h_status || "Unknown"}</span>
						<span>Reset in {fiveHourRemaining}</span>
					</div>
				</div>
			)}

			{/* 7-Day Weekly Limit */}
			{has7dData && (
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							{getStatusIcon(sevenDayStatus)}
							<span className="text-sm font-medium">7-Day Weekly</span>
						</div>
						<span className="text-xs text-muted-foreground">
							{sevenDayPercentage.toFixed(0)}%
						</span>
					</div>
					<Progress
						value={sevenDayPercentage}
						className="h-2"
						indicatorClassName={getProgressColor(sevenDayStatus)}
					/>
					<div className="flex items-center justify-between text-xs text-muted-foreground">
						<span>{account.unified_7d_status || "Unknown"}</span>
						<span>Reset in {sevenDayRemaining}</span>
					</div>
				</div>
			)}

			{/* Representative Claim (if available) */}
			{account.unified_representative_claim && (
				<div className="text-xs text-muted-foreground border-t pt-2">
					{account.unified_representative_claim}
				</div>
			)}
		</div>
	);
}
