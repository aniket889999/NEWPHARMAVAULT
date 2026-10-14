import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import {
    BarChart,
    Activity,
    Shield,
    AlertTriangle,
    Users,
    TrendingUp,
    ChevronRight,
    Zap
} from 'lucide-react';

interface DashboardVisualsProps {
    analytics: any;
    onStatClick: (statName: string) => void;
    onMedicineClick: (medicine: any) => void;
    onActionClick: (action: string) => void;
}

const DashboardVisuals: React.FC<DashboardVisualsProps> = ({
    analytics,
    onStatClick,
    onMedicineClick,
    onActionClick
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const barsRef = useRef<(HTMLDivElement | null)[]>([]);
    const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        if (!analytics || !containerRef.current) return;

        const ctx = gsap.context(() => {
            // Entrance animation for the whole container
            gsap.from(".visual-container", {
                opacity: 0,
                y: 20,
                duration: 0.8,
                ease: "power3.out"
            });

            // Animate stat bars
            barsRef.current.forEach((bar, i) => {
                if (bar) {
                    gsap.from(bar, {
                        height: 0,
                        duration: 1.2,
                        delay: 0.2 + i * 0.1,
                        ease: "elastic.out(1, 0.5)"
                    });
                }
            });

            // Animate medicine cards
            cardsRef.current.forEach((card, i) => {
                if (card) {
                    gsap.from(card, {
                        x: 50,
                        opacity: 0,
                        duration: 0.6,
                        delay: 0.5 + i * 0.1,
                        ease: "power2.out"
                    });
                }
            });

            // Floating animation for labels
            gsap.to(".floating-icon", {
                y: -5,
                duration: 2,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut",
                stagger: 0.2
            });
        }, containerRef);

        return () => ctx.revert();
    }, [analytics]);

    if (!analytics) return null;

    const stats = [
        { name: 'Medicines', value: analytics.totalMedicines, color: 'from-blue-500 to-blue-600', icon: <BarChart /> },
        { name: 'Security', value: analytics.authenticityChecks, color: 'from-emerald-500 to-emerald-600', icon: <Shield /> },
        { name: 'Alerts', value: analytics.interactionAlerts, color: 'from-amber-500 to-amber-600', icon: <AlertTriangle /> },
        { name: 'Users', value: analytics.totalUsers, color: 'from-violet-500 to-violet-600', icon: <Users /> }
    ];

    const maxVal = Math.max(...stats.map(s => s.value));

    return (
        <div ref={containerRef} className="visual-container grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Dynamic Bar Chart Visual */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                            <Activity size={20} />
                        </div>
                        <h3 className="font-bold text-slate-800 text-lg">System Performance</h3>
                    </div>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Metrics</div>
                </div>

                <div className="flex-1 flex items-end justify-between gap-4 px-4 pb-4">
                    {stats.map((stat, i) => {
                        const heightPerc = (stat.value / maxVal) * 100;
                        return (
                            <div
                                key={stat.name}
                                className="flex-1 flex flex-col items-center gap-4 cursor-pointer group"
                                onClick={() => onStatClick(stat.name)}
                            >
                                <div className="relative w-full flex justify-center items-end h-40 bg-slate-50 rounded-xl overflow-hidden">
                                    <div
                                        ref={el => barsRef.current[i] = el}
                                        className={`w-full bg-gradient-to-t ${stat.color} rounded-t-lg transition-all duration-300 group-hover:brightness-110 shadow-lg`}
                                        style={{ height: `${heightPerc}%` }}
                                    >
                                        <div className="absolute top-2 left-0 right-0 flex justify-center">
                                            <span className="text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                                {stat.value.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="floating-icon text-slate-400 group-hover:text-slate-600 transition-colors mb-1">
                                        {React.cloneElement(stat.icon as React.ReactElement, { size: 18 })}
                                    </div>
                                    <span className="text-sm font-semibold text-slate-600">{stat.name}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Popular Items Animated List */}
            <div className="bg-slate-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 text-white">
                    <Zap size={120} />
                </div>

                <div className="relative z-10">
                    <h3 className="text-white font-bold text-lg mb-6 flex items-center gap-2">
                        <TrendingUp size={20} className="text-emerald-400" />
                        Trending Drugs
                    </h3>

                    <div className="space-y-4">
                        {analytics.popularMedicines?.slice(0, 3).map((medicine: any, i: number) => (
                            <div
                                key={medicine.id}
                                ref={el => cardsRef.current[i] = el}
                                className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl p-4 cursor-pointer transition-all hover:translate-x-2 group"
                                onClick={() => onMedicineClick(medicine)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                                            {i + 1}
                                        </div>
                                        <div>
                                            <div className="text-white font-medium text-sm group-hover:text-emerald-300 transition-colors">{medicine.name}</div>
                                            <div className="text-white/40 text-xs">₹{medicine.price}</div>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-white/20 group-hover:text-white transition-colors" />
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        className="w-full mt-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                        onClick={() => onActionClick('view_all')}
                    >
                        Explore Market <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DashboardVisuals;
