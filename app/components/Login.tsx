"use client"
import Link from 'next/link'
import { signIn, signOut, useSession } from 'next-auth/react'

function Authbutton() {
  const { data: session } = useSession()

  if (session) {
    return (
      <>
        Signed in as {session?.user?.name} <br />
        <button onClick={() => signOut()}>Sign out</button>
      </>
    )
  }
  return (
    <>
      Not signed in <br />
      <button onClick={() => signIn()}>Sign in</button>
    </>
  )
}


export default function Login() {
    return (
        <div>
            <Authbutton />
        </div>
    )
}