import { Link, useLocation } from "wouter";
import { Bell } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ui/theme-provider";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Sidebar from "@/components/layout/Sidebar";

const Navbar = () => {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();

  return (
    <nav className="bg-white shadow-sm border-b border-neutral-200">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center text-white">
                <span className="font-bold">MDM</span>
              </div>
              <span className="ml-2 text-xl font-semibold text-neutral-900">MDM Portal</span>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link href="/">
                <span className={`${location === "/" ? "border-primary text-neutral-900" : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700"} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium cursor-pointer`}>
                  Dashboard
                </span>
              </Link>
              <Link href="/products">
                <span className={`${location === "/products" ? "border-primary text-neutral-900" : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700"} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium cursor-pointer`}>
                  Products
                </span>
              </Link>
              <Link href="/data-imports">
                <span className={`${location === "/data-imports" ? "border-primary text-neutral-900" : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700"} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium cursor-pointer`}>
                  Data Imports
                </span>
              </Link>
              <Link href="/approvals">
                <span className={`${location === "/approvals" ? "border-primary text-neutral-900" : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700"} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium cursor-pointer`}>
                  Approvals
                </span>
              </Link>
              <Link href="/settings">
                <span className={`${location === "/settings" ? "border-primary text-neutral-900" : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700"} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium cursor-pointer`}>
                  Settings
                </span>
              </Link>
            </div>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            <Button variant="ghost" size="icon" className="p-1 rounded-full text-neutral-500 hover:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
              <Bell className="h-5 w-5" />
            </Button>
            <div className="ml-3 relative">
              <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" alt="User" />
                <AvatarFallback>US</AvatarFallback>
              </Avatar>
            </div>
          </div>
          <div className="-mr-2 flex items-center sm:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="bg-white inline-flex items-center justify-center p-2 rounded-md text-neutral-400 hover:text-neutral-500 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[400px]">
                <div className="h-full py-4">
                  <Sidebar />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
