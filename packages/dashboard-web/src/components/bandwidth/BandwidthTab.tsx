import { useEffect, useState } from "react";
import { BandwidthCard } from "./BandwidthCard";
import { BandwidthSummary } from "./BandwidthSummary";

interface BandwidthData {
	success: boolean;
	data: {
		totalAccounts: number;
		healthyAccounts: number;
		warningAccounts: number;
		criticalAccounts: number;
		rateLimitedAccounts: number;
		totalImmediateCapacity: {
			requests: number;
			tokens: number;
		};
		nextResetTimes: Array<{
			accountId: string;
			accountName: string;
			resetTime: number;
			secondsUntilReset: number;
		}>;
		accountStatuses: Array<{
			accountId: string;
			accountName: string;
			tier: number;
			status: "healthy" | "warning" | "critical" | "rate_limited";
			statusMessage: string;
			immediateCapacity: {
				requests: number;
				tokens: number;
			};
		}>;
	};
	timestamp: string;
}

export function BandwidthTab() {
	const [bandwidthData, setBandwidthData] = useState<BandwidthData | null>(
		null,
	);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchBandwidthData = async () => {
		try {
			setLoading(true);
			const response = await fetch("/api/bandwidth/summary");

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			setBandwidthData(data);
			setError(null);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to fetch bandwidth data",
			);
			console.error("Error fetching bandwidth data:", err);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchBandwidthData();

		// Set up auto-refresh every 30 seconds
		const interval = setInterval(fetchBandwidthData, 30000);

		return () => clearInterval(interval);
	}, [fetchBandwidthData]);

	if (loading && !bandwidthData) {
		return (
			<div className="p-6">
				<div className="animate-pulse space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
						{[1, 2, 3, 4].map((i) => (
							<div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
						))}
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{[1, 2, 3].map((i) => (
							<div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
						))}
					</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-6">
				<div className="bg-red-50 border border-red-200 rounded-lg p-4">
					<h3 className="text-red-800 font-medium">
						Error Loading Bandwidth Data
					</h3>
					<p className="text-red-600 text-sm mt-1">{error}</p>
					<button
						onClick={fetchBandwidthData}
						className="mt-2 px-3 py-1 bg-red-100 text-red-800 text-sm rounded hover:bg-red-200 transition-colors"
					>
						Retry
					</button>
				</div>
			</div>
		);
	}

	if (!bandwidthData?.data) {
		return (
			<div className="p-6 text-center text-gray-500">
				No bandwidth data available
			</div>
		);
	}

	const { data } = bandwidthData;

	// Create a map of reset times for easy lookup
	const resetTimesMap = new Map(
		data.nextResetTimes.map((item) => [item.accountId, item.secondsUntilReset]),
	);

	return (
		<div className="p-6 space-y-6">
			{/* Header */}
			<div className="flex justify-between items-center">
				<div>
					<h2 className="text-2xl font-bold text-gray-900">
						Bandwidth Monitor
					</h2>
					<p className="text-gray-600 text-sm">
						Real-time quota usage and reset predictions
					</p>
				</div>
				<div className="text-right">
					<div className="text-xs text-gray-500">Last Updated</div>
					<div className="text-sm font-mono">
						{new Date(bandwidthData.timestamp).toLocaleTimeString()}
					</div>
				</div>
			</div>

			{/* Summary Cards */}
			<BandwidthSummary
				totalAccounts={data.totalAccounts}
				healthyAccounts={data.healthyAccounts}
				warningAccounts={data.warningAccounts}
				criticalAccounts={data.criticalAccounts}
				rateLimitedAccounts={data.rateLimitedAccounts}
				totalImmediateCapacity={data.totalImmediateCapacity}
			/>

			{/* Account Details */}
			<div>
				<h3 className="text-lg font-semibold text-gray-900 mb-4">
					Account Details
				</h3>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{data.accountStatuses.map((account) => (
						<BandwidthCard
							key={account.accountId}
							accountName={account.accountName}
							accountId={account.accountId}
							tier={account.tier}
							status={account.status}
							statusMessage={account.statusMessage}
							immediateCapacity={account.immediateCapacity}
							secondsUntilReset={resetTimesMap.get(account.accountId)}
						/>
					))}
				</div>
			</div>

			{/* Auto-refresh indicator */}
			<div className="text-center text-xs text-gray-400">
				Auto-refreshes every 30 seconds
			</div>
		</div>
	);
}
