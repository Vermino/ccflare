import { AccountPresenter } from "@ccflare/ui-common";
import {
	AlertCircle,
	CheckCircle,
	Clock,
	Edit2,
	Pause,
	Play,
	Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { Account } from "../../api";
import { useBandwidthSummary } from "../../hooks/useBandwidth";
import { Button } from "../ui/button";
import { BandwidthIndicator } from "./BandwidthIndicator";
import { RateLimitProgress } from "./RateLimitProgress";

interface EnhancedAccountListItemProps {
	account: Account;
	isActive?: boolean;
	onPauseToggle: (account: Account) => void;
	onRemove: (name: string) => void;
	onRename: (account: Account) => void;
}

export function EnhancedAccountListItem({
	account,
	isActive = false,
	onPauseToggle,
	onRemove,
	onRename,
}: EnhancedAccountListItemProps) {
	const presenter = new AccountPresenter(account);
	const { data: bandwidthData } = useBandwidthSummary();

	// Fetch real Claude usage data from Claude.ai API
	const [claudeUsageData, setClaudeUsageData] = useState<any>(null);

	useEffect(() => {
		const fetchClaudeUsage = async () => {
			try {
				const response = await fetch("http://localhost:8081/api/claude/usage");
				const data = await response.json();
				if (data.success) {
					const accountData = data.data?.find(
						(item: any) =>
							item.accountId === account.id ||
							item.accountName === account.name,
					);
					setClaudeUsageData(accountData);
				}
			} catch (err) {
				console.error("Failed to fetch Claude usage for account:", err);
			}
		};
		fetchClaudeUsage();
		// Refresh every 30 seconds
		const interval = setInterval(fetchClaudeUsage, 30000);
		return () => clearInterval(interval);
	}, [account.id, account.name]);

	// Find bandwidth data for this account (old format - for compatibility)
	const accountBandwidth = bandwidthData?.data?.accountStatuses?.find(
		(status) =>
			status.accountId === account.id || status.accountName === account.name,
	);

	const resetTime = bandwidthData?.data?.nextResetTimes?.find(
		(reset) =>
			reset.accountId === account.id || reset.accountName === account.name,
	);

	return (
		<div
			key={account.name}
			className={`p-4 border rounded-lg transition-colors space-y-4 ${
				isActive
					? "border-primary bg-primary/5 shadow-sm"
					: "border-border hover:border-muted-foreground/50"
			}`}
		>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<div>
						<div className="flex items-center gap-2">
							<p className="font-medium">{account.name}</p>
							{isActive && (
								<span className="px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
									Active
								</span>
							)}
						</div>
						<p className="text-sm text-muted-foreground">
							{account.provider} • {presenter.tierDisplay}
						</p>
					</div>
					<div className="flex items-center gap-2">
						{presenter.isRateLimited ? (
							<AlertCircle className="h-4 w-4 text-yellow-600" />
						) : (
							<CheckCircle className="h-4 w-4 text-green-600" />
						)}
						<span className="text-sm">{presenter.requestCount} requests</span>
						{presenter.isPaused && (
							<span className="text-sm text-muted-foreground">Paused</span>
						)}
						{!presenter.isPaused && presenter.rateLimitStatus !== "OK" && (
							<span className="text-sm text-destructive">
								{presenter.rateLimitStatus}
							</span>
						)}
					</div>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => onRename(account)}
						title="Rename account"
					>
						<Edit2 className="h-4 w-4" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => onPauseToggle(account)}
						title={account.paused ? "Resume account" : "Pause account"}
					>
						{account.paused ? (
							<Play className="h-4 w-4" />
						) : (
							<Pause className="h-4 w-4" />
						)}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => onRemove(account.name)}
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Real Claude Usage from Claude.ai */}
			{claudeUsageData?.usage && (
				<div className="space-y-3 pt-2 border-t">
					<div className="text-xs font-medium text-muted-foreground mb-2">
						Plan usage limits
					</div>

					{/* Current session (5 hours) */}
					<div className="space-y-1">
						<div className="flex items-center justify-between text-xs">
							<span className="text-muted-foreground">Current session</span>
							<span className="font-medium">
								{claudeUsageData.usage.session.percentage}% used
							</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
								<div
									className={`h-full transition-all duration-500 ${
										claudeUsageData.usage.session.percentage >= 90
											? "bg-red-500"
											: claudeUsageData.usage.session.percentage >= 70
												? "bg-yellow-500"
												: "bg-primary"
									}`}
									style={{
										width: `${Math.min(100, claudeUsageData.usage.session.percentage)}%`,
									}}
								/>
							</div>
						</div>
						{claudeUsageData.usage.session.resetAt && (
							<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
								<Clock className="h-3 w-3" />
								<span>
									Resets{" "}
									{new Date(
										claudeUsageData.usage.session.resetAt,
									).toLocaleString()}
								</span>
							</div>
						)}
					</div>

					{/* Weekly - All models */}
					<div className="space-y-1">
						<div className="flex items-center justify-between text-xs">
							<span className="text-muted-foreground">All models (weekly)</span>
							<span className="font-medium">
								{claudeUsageData.usage.weekly.percentage}% used
							</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
								<div
									className={`h-full transition-all duration-500 ${
										claudeUsageData.usage.weekly.percentage >= 90
											? "bg-red-500"
											: claudeUsageData.usage.weekly.percentage >= 70
												? "bg-yellow-500"
												: "bg-primary"
									}`}
									style={{
										width: `${Math.min(100, claudeUsageData.usage.weekly.percentage)}%`,
									}}
								/>
							</div>
						</div>
						{claudeUsageData.usage.weekly.resetAt && (
							<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
								<Clock className="h-3 w-3" />
								<span>
									Resets{" "}
									{new Date(
										claudeUsageData.usage.weekly.resetAt,
									).toLocaleString()}
								</span>
							</div>
						)}
					</div>

					{/* Weekly - Opus only (if used) */}
					{claudeUsageData.usage.weeklyOpus.percentage > 0 && (
						<div className="space-y-1">
							<div className="flex items-center justify-between text-xs">
								<span className="text-muted-foreground">
									Opus only (weekly)
								</span>
								<span className="font-medium">
									{claudeUsageData.usage.weeklyOpus.percentage}% used
								</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
									<div
										className={`h-full transition-all duration-500 ${
											claudeUsageData.usage.weeklyOpus.percentage >= 90
												? "bg-red-500"
												: claudeUsageData.usage.weeklyOpus.percentage >= 70
													? "bg-yellow-500"
													: "bg-primary"
										}`}
										style={{
											width: `${Math.min(100, claudeUsageData.usage.weeklyOpus.percentage)}%`,
										}}
									/>
								</div>
							</div>
							{claudeUsageData.usage.weeklyOpus.resetAt && (
								<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
									<Clock className="h-3 w-3" />
									<span>
										Resets{" "}
										{new Date(
											claudeUsageData.usage.weeklyOpus.resetAt,
										).toLocaleString()}
									</span>
								</div>
							)}
						</div>
					)}
				</div>
			)}

			{/* Original rate limit progress - keep for compatibility */}
			{account.rateLimitReset && (
				<RateLimitProgress resetIso={account.rateLimitReset} />
			)}

			{/* New bandwidth indicator */}
			{accountBandwidth && (
				<BandwidthIndicator
					accountId={account.id}
					status={accountBandwidth.status}
					statusMessage={accountBandwidth.statusMessage}
					immediateCapacity={accountBandwidth.immediateCapacity}
					tier={accountBandwidth.tier}
					secondsUntilReset={resetTime?.secondsUntilReset}
				/>
			)}
		</div>
	);
}
