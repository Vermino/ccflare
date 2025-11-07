import { cn } from "../lib/utils";
import { Progress } from "./ui/progress";

interface UsageBarProps {
	label: string;
	used: number;
	total: number;
	className?: string;
	showPercentage?: boolean;
	showNumbers?: boolean;
}

export function UsageBar({
	label,
	used,
	total,
	className,
	showPercentage = true,
	showNumbers = false,
}: UsageBarProps) {
	const percentage = total > 0 ? ((used / total) * 100).toFixed(1) : 0;
	const percentageValue = total > 0 ? (used / total) * 100 : 0;

	// Color coding based on usage
	const getColorClass = () => {
		if (percentageValue >= 90) return "bg-red-500";
		if (percentageValue >= 70) return "bg-yellow-500";
		return "bg-green-500";
	};

	return (
		<div className={cn("space-y-1", className)}>
			<div className="flex items-center justify-between text-xs">
				<span className="text-muted-foreground">{label}</span>
				{showPercentage && (
					<span className="font-medium">{percentage}% used</span>
				)}
				{showNumbers && (
					<span className="text-muted-foreground">
						{used.toLocaleString()} / {total.toLocaleString()}
					</span>
				)}
			</div>
			<div className="relative">
				<Progress value={percentageValue} className="h-2" />
				<div
					className={cn(
						"absolute top-0 left-0 h-2 rounded-full transition-all duration-700 ease-out",
						getColorClass(),
					)}
					style={{ width: `${percentageValue}%` }}
				/>
			</div>
		</div>
	);
}
