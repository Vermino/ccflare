import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface BandwidthSummaryProps {
	totalAccounts: number;
	healthyAccounts: number;
	warningAccounts: number;
	criticalAccounts: number;
	rateLimitedAccounts: number;
	totalImmediateCapacity: {
		requests: number;
		tokens: number;
	};
}

export function BandwidthSummary({
	totalAccounts,
	healthyAccounts,
	warningAccounts,
	criticalAccounts,
	rateLimitedAccounts,
	totalImmediateCapacity,
}: BandwidthSummaryProps) {
	const getAccountStatusStats = () => [
		{ label: "Healthy", count: healthyAccounts, color: "text-green-600" },
		{ label: "Warning", count: warningAccounts, color: "text-yellow-600" },
		{ label: "Critical", count: criticalAccounts, color: "text-orange-600" },
		{
			label: "Rate Limited",
			count: rateLimitedAccounts,
			color: "text-red-600",
		},
	];

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
			{/* Total Accounts */}
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-medium text-gray-600">
						Total Accounts
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">{totalAccounts}</div>
				</CardContent>
			</Card>

			{/* Account Status Breakdown */}
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-medium text-gray-600">
						Account Status
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-1">
						{getAccountStatusStats().map(({ label, count, color }) => (
							<div key={label} className="flex justify-between text-xs">
								<span className={color}>{label}</span>
								<span className="font-medium">{count}</span>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Total Immediate Requests */}
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-medium text-gray-600">
						Available Requests
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">
						{totalImmediateCapacity.requests}
					</div>
					<div className="text-xs text-gray-500">requests ready now</div>
				</CardContent>
			</Card>

			{/* Total Immediate Tokens */}
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-medium text-gray-600">
						Available Tokens
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">
						{totalImmediateCapacity.tokens.toLocaleString()}
					</div>
					<div className="text-xs text-gray-500">tokens ready now</div>
				</CardContent>
			</Card>
		</div>
	);
}
