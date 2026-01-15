'use client'

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <html>
            <body>
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(to bottom right, #111827, #581c87, #111827)',
                    fontFamily: 'system-ui, sans-serif'
                }}>
                    <div style={{ textAlign: 'center', padding: '2rem', maxWidth: '400px' }}>
                        <h2 style={{ color: 'white', fontSize: '1.5rem', marginBottom: '1rem' }}>
                            Something went wrong!
                        </h2>
                        <p style={{ color: '#9ca3af', marginBottom: '1.5rem' }}>
                            {error.message || 'A critical error occurred.'}
                        </p>
                        <button
                            onClick={() => reset()}
                            style={{
                                padding: '0.75rem 1.5rem',
                                backgroundColor: '#7c3aed',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.5rem',
                                cursor: 'pointer',
                                fontSize: '1rem'
                            }}
                        >
                            Try again
                        </button>
                    </div>
                </div>
            </body>
        </html>
    )
}
