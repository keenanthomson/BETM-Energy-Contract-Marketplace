import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ContractTable } from "@/components/ContractTable";
import { FilterPanel } from "@/components/FilterPanel";
import { PortfolioPanel } from "@/components/PortfolioPanel";
import { usePortfolio } from "@/hooks/usePortfolio";

type MobileTab = "contracts" | "portfolio";

export function Layout() {
  const [tab, setTab] = useState<MobileTab>("contracts");
  const { data: portfolio } = usePortfolio();
  const portfolioCount = portfolio?.metrics.total_contracts ?? 0;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-4 py-2.5">
        <h1 className="font-heading text-lg font-semibold">
          Energy Contract Marketplace
        </h1>
        <div className="hidden md:block">
          <FilterPanel />
        </div>
      </header>

      {/* Desktop: split panels */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <main className="flex flex-1 flex-col overflow-hidden">
          <ContractTable />
        </main>
        <PortfolioPanel />
      </div>

      {/* Mobile: single-tab view */}
      <div className="flex md:hidden flex-1 flex-col overflow-hidden">
        {tab === "contracts" && (
          <>
            <div className="flex items-center justify-between border-b px-4 py-2">
              <FilterPanel />
            </div>
            <ContractTable />
          </>
        )}
        {tab === "portfolio" && <PortfolioPanel />}
      </div>

      {/* Mobile tab bar */}
      <nav className="flex md:hidden border-t bg-background">
        <Button
          variant={tab === "contracts" ? "secondary" : "ghost"}
          className="flex-1 rounded-none"
          onClick={() => setTab("contracts")}
        >
          Contracts
        </Button>
        <Button
          variant={tab === "portfolio" ? "secondary" : "ghost"}
          className="flex-1 rounded-none"
          onClick={() => setTab("portfolio")}
        >
          Portfolio
          {portfolioCount > 0 && (
            <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
              {portfolioCount}
            </span>
          )}
        </Button>
      </nav>
    </div>
  );
}
