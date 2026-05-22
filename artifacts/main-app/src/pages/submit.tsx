import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Submit() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/get-email");
  }, [setLocation]);
  return null;
}
