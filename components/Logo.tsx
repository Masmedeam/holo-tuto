import Image from "next/image";
import Link from "next/link";

export function Logo() {
  return (
    <Link className="brand" href="/" aria-label="Voodoo home">
      <Image className="logo" src="/landing/voodoo-icon-v2.webp" alt="" width={40} height={40} priority />
      <span>Voodoo</span>
    </Link>
  );
}
